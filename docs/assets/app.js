/* ============================================================
 * Future Prediction Theme Intelligence Dashboard
 * Vanilla JS (ES module). D3 v7 loaded globally via <script>.
 * Contract: docs/data/manifest.json + docs/data/graph-<scope>.json
 * ============================================================ */

(function () {
  "use strict";

  /* ---------------- Config ---------------- */

  const DATA_DIR = "data";
  const STORAGE_KEY = "fp-dashboard-state";
  // Base URL used to turn report/validation paths into GitHub article links.
  // Change this if you fork the repo.
  const REPO_BLOB_URL = "https://github.com/baba-yu/news/blob/main/";

  // Zoom thresholds (UI §7.1)
  const ZOOM_THRESHOLDS = {
    showCategories: 0.75,
    showSubthemes: 1.25,
    showPredictions: 2.0,
  };

  // Node radius by type. Kept smaller than the UI spec §8.4 suggestion
  // (28/24/16/9) — the original sizes read too heavy with ~30 nodes on
  // screen. Frontend value wins over any node.layout.radius from the
  // backend so the UI stays under our control.
  const RADIUS_BY_TYPE = {
    category: 11,
    theme: 8,
    subtheme: 5,
    prediction: 3,
  };

  // Per-type depth half-range. d3-force is 2D, so we assign each node a
  // stable z at init derived from its id. Rotation then actually shows
  // depth instead of collapsing everything to a line.
  const Z_RANGE_BY_TYPE = {
    category: 30,
    theme: 70,
    subtheme: 100,
    prediction: 140,
  };

  // Heat color stops (UI §8.2). Index 0..4 plus a hot core band.
  const HEAT_STOPS = [
    { t: 0.00, c: "#203047" }, // --heat-0
    { t: 0.25, c: "#2464a8" }, // --heat-1
    { t: 0.50, c: "#18c7d8" }, // --heat-2
    { t: 0.70, c: "#ffb84d" }, // --heat-3
    { t: 0.88, c: "#ff4d2e" }, // --heat-4
    { t: 1.00, c: "#fff3c4" }, // --heat-core
  ];

  const WARN_T = 0.40;
  const WARN_STRONG_T = 0.25;
  const CONTRADICT_T = 0.60;

  // A node is considered "new / unvalidated" in the current window when
  // it has no per-day activity entries — i.e. nothing cited this
  // prediction/theme yet. It's distinct from "low realization" (which
  // means we *did* see it but it landed poorly).
  function hasEvidence(m) {
    return Array.isArray(m && m.grass_daily) && m.grass_daily.length > 0;
  }

  /* ---------------- State ---------------- */

  const state = {
    manifest: null,
    scopeId: "tech",
    windowId: "30d",
    graphsByScope: new Map(),   // scope_id -> parsed graph
    selectedNodeId: null,
    focusedNodeId: null,

    // Viewport
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    rotation: { x: 0, y: 0 },

    // Tool: "rotate" or "pan" — primary empty-space drag behavior.
    // shift/space temporarily flips to the other tool regardless of setting.
    tool: "rotate",

    // Category visibility filter. Keys are like "tech.security" — when
    // a category id is in this set, that category and everything under
    // it is hidden. Stored per scope in localStorage.
    hiddenByScope: {}, // { [scopeId]: Set<string> }

    // Interaction scratch
    isPointerDown: false,
    pointerStart: null,
    pointerCurrent: null,
    axisLocked: null,
    draggingNode: null,
    dragOffset: null,   // screen-space offset between pointer and node at pick-up
    panMode: false,     // true when current drag pans (tool=pan or shift/space held)

    // Sim + data (live)
    simulation: null,
    renderNodes: [],
    renderLinks: [],

    // Canvas
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    dpr: 1,
    lastFrame: 0,
  };

  /* ---------------- Utilities ---------------- */

  function setStatus(msg, isErr) {
    const el = document.getElementById("app-status");
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function saveState() {
    try {
      const hidden = {};
      for (const [k, v] of Object.entries(state.hiddenByScope)) {
        hidden[k] = Array.from(v || []);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scopeId: state.scopeId,
        windowId: state.windowId,
        tool: state.tool,
        hidden: hidden,
      }));
    } catch (_) { /* ignore */ }
  }

  function currentHidden() {
    let s = state.hiddenByScope[state.scopeId];
    if (!s) { s = new Set(); state.hiddenByScope[state.scopeId] = s; }
    return s;
  }

  function categoryIdOf(node) {
    // Every node (category/theme/subtheme/prediction) carries category_id
    // when exported by the backend; a theme's id IS its category’s child,
    // and category nodes have category_id == their own id.
    if (node.type === "category") return node.id;
    return node.category_id || null;
  }

  function nodeIsHidden(node) {
    const hidden = currentHidden();
    if (!hidden.size) return false;
    // Predictions may attach to multiple categories via parent_ids (1:N).
    // Show a prediction if ANY of its linked categories is still visible.
    if (node.type === "prediction" && Array.isArray(node.parent_ids)) {
      const linked = new Set();
      const g = currentGraph();
      if (g && g._index) {
        for (const pid of node.parent_ids) {
          const pn = g._index.get(pid);
          if (pn && pn.category_id) linked.add(pn.category_id);
        }
      }
      if (linked.size === 0) {
        const own = categoryIdOf(node);
        return !!(own && hidden.has(own));
      }
      for (const c of linked) if (!hidden.has(c)) return false;
      return true;
    }
    const own = categoryIdOf(node);
    return !!(own && hidden.has(own));
  }
  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  // Linear interpolate between HEAT_STOPS by t in [0,1]
  function heatColor(t) {
    t = clamp(t || 0, 0, 1);
    for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
      const a = HEAT_STOPS[i], b = HEAT_STOPS[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return lerpColor(a.c, b.c, f);
      }
    }
    return HEAT_STOPS[HEAT_STOPS.length - 1].c;
  }
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  function lerpColor(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // Stable 0..1 hash so each node id gets the same z every reload.
  function hashUnit(s) {
    let h = 2166136261 >>> 0;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  }

  function zFor(node) {
    const range = Z_RANGE_BY_TYPE[node.type] || 40;
    const t = hashUnit(node.id) * 2 - 1; // -1..1
    return t * range;
  }

  function radiusFor(node) {
    // Prefer our per-type config over layout.radius so updating RADIUS_BY_TYPE
    // actually changes visible size. Fall back to layout.radius only for
    // unknown node types, with a conservative cap.
    const byType = RADIUS_BY_TYPE[node.type];
    if (typeof byType === "number") return byType;
    const layoutR = node.layout && typeof node.layout.radius === "number" ? node.layout.radius : 10;
    return Math.min(layoutR, 14);
  }

  function metricsFor(node, windowId) {
    const bw = node.metrics_by_window || {};
    return bw[windowId] || bw["30d"] || bw["7d"] || bw["90d"] || {};
  }

  /* ---------------- Graph data helpers ---------------- */

  function currentGraph() {
    return state.graphsByScope.get(state.scopeId) || null;
  }

  function nodeById(id) {
    const g = currentGraph();
    if (!g) return null;
    return g._index ? g._index.get(id) : null;
  }

  function indexGraph(graph) {
    const idx = new Map();
    for (const n of graph.nodes) idx.set(n.id, n);
    graph._index = idx;
    return graph;
  }

  /* ---------------- Visibility by zoom ---------------- */

  function isVisibleAtZoom(node, zoom) {
    // Category filter overrides everything else.
    if (nodeIsHidden(node)) return false;

    // Respect explicit per-node visibility hint
    const v = node.visibility || {};
    const minZ = (typeof v.min_zoom === "number") ? v.min_zoom : null;
    const maxZ = (typeof v.max_zoom === "number") ? v.max_zoom : null;
    if (minZ !== null && zoom < minZ) return false;
    if (maxZ !== null && zoom > maxZ) return false;

    // Fallback: generic zoom thresholds by type
    if (node.type === "theme") return true;
    if (node.type === "category") return zoom >= ZOOM_THRESHOLDS.showCategories;
    if (node.type === "subtheme") return zoom >= ZOOM_THRESHOLDS.showSubthemes;
    if (node.type === "prediction") return zoom >= ZOOM_THRESHOLDS.showPredictions;
    return true;
  }

  function labelVisibleForNode(node, zoom) {
    if (node.type === "prediction") return zoom >= ZOOM_THRESHOLDS.showPredictions;
    if (node.type === "subtheme") return zoom >= ZOOM_THRESHOLDS.showSubthemes;
    return zoom >= 0.6;
  }

  /* ---------------- Fetch ---------------- */

  async function fetchJSON(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
    return r.json();
  }

  async function loadManifest() {
    setStatus("loading manifest…");
    state.manifest = await fetchJSON(`${DATA_DIR}/manifest.json`);
    // Apply defaults if user had no persisted state
    if (!loadPersisted()) {
      state.scopeId = state.manifest.default_scope || "tech";
      state.windowId = state.manifest.default_window || "30d";
    }
    updateMetaHeader();
  }

  async function loadScopeGraph(scopeId) {
    if (state.graphsByScope.has(scopeId)) return state.graphsByScope.get(scopeId);
    const scope = (state.manifest.scopes || []).find((s) => s.scope_id === scopeId);
    const file = (scope && scope.graph_file) || `graph-${scopeId}.json`;
    setStatus(`loading ${file}…`);
    const g = await fetchJSON(`${DATA_DIR}/${file}`);
    indexGraph(g);
    state.graphsByScope.set(scopeId, g);
    return g;
  }

  function updateMetaHeader() {
    const el = document.getElementById("meta-sub");
    if (!el || !state.manifest) return;
    const report = state.manifest.latest_report_date || "";
    const build = state.manifest.build_id || "";
    el.textContent = `scope: ${state.scopeId} · window: ${state.windowId} · report ${report || "—"} · build ${build.slice(0, 10) || "—"}`;
  }

  /* ---------------- Simulation ---------------- */

  function rebuildSimulation() {
    const g = currentGraph();
    if (!g) return;

    // Filter nodes/links by zoom visibility
    const visibleNodes = g.nodes.filter((n) => isVisibleAtZoom(n, state.zoom));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = (g.links || [])
      .filter((l) => visibleIds.has(linkEndId(l.source)) && visibleIds.has(linkEndId(l.target)))
      .map((l) => ({ ...l })); // shallow copy so d3 can mutate

    // Prepare render nodes — reuse existing positions if same id present
    const prior = new Map(state.renderNodes.map((n) => [n.id, n]));
    const rn = visibleNodes.map((n) => {
      const p = prior.get(n.id);
      const init = n.layout || {};
      // z is derived from the stable id hash (see zFor). Simulation stays
      // 2D in (x, y); z is fixed per node so rotation reveals real depth.
      const z = (p && typeof p.z === "number") ? p.z : zFor(n);
      return Object.assign({}, n, {
        x: p ? p.x : (typeof init.x === "number" ? init.x + state.width / 2 : state.width / 2 + (Math.random() - 0.5) * 60),
        y: p ? p.y : (typeof init.y === "number" ? init.y + state.height / 2 : state.height / 2 + (Math.random() - 0.5) * 60),
        z: z,
        vx: p ? p.vx : 0,
        vy: p ? p.vy : 0,
        fx: p ? p.fx : null,
        fy: p ? p.fy : null,
      });
    });
    state.renderNodes = rn;
    state.renderLinks = visibleLinks;

    if (state.simulation) state.simulation.stop();

    const linkForce = d3.forceLink(visibleLinks)
      .id((d) => d.id)
      .distance((l) => {
        const sType = typeOf(l.source, rn);
        const tType = typeOf(l.target, rn);
        if (sType === "category" || tType === "category") return 140;
        if (sType === "theme"    || tType === "theme")    return 100;
        if (sType === "subtheme" || tType === "subtheme") return 70;
        return 55;
      })
      .strength(0.35);

    const charge = d3.forceManyBody().strength((d) => {
      if (d.type === "category") return -420;
      if (d.type === "theme")    return -300;
      if (d.type === "subtheme") return -160;
      return -90;
    });

    const cx = state.width / 2, cy = state.height / 2;
    // Pull each node toward the world origin. Stronger than d3.forceCenter
    // (which only re-centers the centroid) so the cloud stays anchored
    // around the crosshair instead of drifting off-screen.
    const pullX = d3.forceX(cx).strength(0.08);
    const pullY = d3.forceY(cy).strength(0.08);
    const collide = d3.forceCollide().radius((d) => radiusFor(d) + 6).strength(0.85);

    state.simulation = d3.forceSimulation(rn)
      .force("link", linkForce)
      .force("charge", charge)
      .force("x", pullX)
      .force("y", pullY)
      .force("collide", collide)
      .alpha(0.7)
      .alphaDecay(0.03)
      .velocityDecay(0.35)
      .on("tick", scheduleDraw);

    scheduleDraw();
  }

  function typeOf(ref, rn) {
    if (ref && typeof ref === "object") return ref.type;
    const m = rn.find((n) => n.id === ref);
    return m ? m.type : null;
  }
  function linkEndId(end) {
    return (end && typeof end === "object") ? end.id : end;
  }

  /* ---------------- Canvas drawing ---------------- */

  function resizeCanvas() {
    const c = state.canvas;
    state.dpr = Math.max(1, window.devicePixelRatio || 1);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    c.width = Math.floor(state.width * state.dpr);
    c.height = Math.floor(state.height * state.dpr);
    c.style.width = state.width + "px";
    c.style.height = state.height + "px";
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  let drawScheduled = false;
  function scheduleDraw() {
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      draw();
      drawLabels();
    });
  }

  // Proper 3D rotation (graph lives on the z=0 plane).
  // Yaw about Y then pitch about X, then orthographic projection with
  // zoom and pan. The resulting z is the depth value used for front/back
  // sorting so nodes toward the viewer overlap nodes behind them.
  function projectNode(nx, ny, nz) {
    const cx = state.width / 2;
    const cy = state.height / 2;

    const x0 = nx - cx;
    const y0 = ny - cy;
    const z0 = (typeof nz === "number") ? nz : 0;

    const cy0 = Math.cos(state.rotation.y), sy0 = Math.sin(state.rotation.y);
    const cx0 = Math.cos(state.rotation.x), sx0 = Math.sin(state.rotation.x);

    // Yaw around Y axis
    const x1 =  x0 * cy0 + z0 * sy0;
    const y1 =  y0;
    const z1 = -x0 * sy0 + z0 * cy0;

    // Pitch around X axis
    const x2 =  x1;
    const y2 =  y1 * cx0 - z1 * sx0;
    const z2 =  y1 * sx0 + z1 * cx0;

    // Slight foreshortening: nodes closer to viewer get drawn a touch larger.
    // Keep subtle (±8%) so the knowledge graph reads as flat-ish tilt.
    const depthScale = 1 + z2 * 0.0008;

    return {
      x: cx + x2 * state.zoom + state.pan.x,
      y: cy + y2 * state.zoom + state.pan.y,
      z: z2,
      scale: state.zoom * depthScale,
    };
  }

  // Inverse of projectNode for a given fixed z_world.
  // During drag we keep the node at its own z and solve for world x, y
  // that project to the desired screen coords.
  function unprojectScreen(px, py, nz) {
    const cx = state.width / 2;
    const cy = state.height / 2;
    const z0 = (typeof nz === "number") ? nz : 0;

    const sx = (px - cx - state.pan.x) / state.zoom;
    const sy = (py - cy - state.pan.y) / state.zoom;

    const cy0 = Math.cos(state.rotation.y), sy0 = Math.sin(state.rotation.y);
    const cx0 = Math.cos(state.rotation.x), sx0 = Math.sin(state.rotation.x);

    // Forward (keeping z_world = z0 constant):
    //   sx = x * cosY + z * sinY
    //   sy = y * cosX + x * sinY * sinX - z * cosY * sinX
    const EPS = 1e-6;
    const x = Math.abs(cy0) < EPS ? 0 : (sx - z0 * sy0) / cy0;
    const y = Math.abs(cx0) < EPS
      ? 0
      : (sy + z0 * cy0 * sx0 - x * sy0 * sx0) / cx0;
    return { x: x + cx, y: y + cy };
  }

  function draw() {
    const ctx = state.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, state.width, state.height);

    const focused = state.focusedNodeId;
    const related = focused ? relatedIds(focused) : null;

    // Draw the origin marker (before links so it sits underneath).
    drawCenterMarker(ctx);

    // --- Links ---
    ctx.lineCap = "round";
    for (const l of state.renderLinks) {
      const s = (typeof l.source === "object") ? l.source : nodeById(l.source);
      const t = (typeof l.target === "object") ? l.target : nodeById(l.target);
      if (!s || !t) continue;
      const ps = projectNode(s.x, s.y, s.z);
      const pt = projectNode(t.x, t.y, t.z);

      let alpha = 0.28;
      if (focused) {
        if (related.has(s.id) && related.has(t.id)) alpha = 0.75;
        else alpha = 0.08;
      }

      let stroke = `rgba(130, 170, 210, ${alpha})`;
      let dash = null;
      if (l.type === "contradicts") stroke = `rgba(199, 75, 216, ${Math.max(alpha, 0.5)})`;
      else if (l.type === "supports") stroke = `rgba(24, 199, 216, ${Math.max(alpha, 0.45)})`;
      else if (l.type === "derived_from") stroke = `rgba(255, 184, 77, ${Math.max(alpha, 0.4)})`;
      else if (l.type === "shares_prediction") {
        // Dashed gold line between categories that share a prediction.
        stroke = `rgba(255, 184, 77, ${Math.max(alpha * 0.85, 0.4)})`;
        dash = [6, 5];
      }

      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.6, (l.weight || 1) * 1.1);
      if (dash) ctx.setLineDash(dash); else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ps.x, ps.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    // --- Nodes (z-sorted: farther first, closer last = on top) ---
    const drawOrder = state.renderNodes
      .map((n) => ({ n, z: projectNode(n.x, n.y, n.z).z }))
      .sort((a, b) => a.z - b.z);
    for (const entry of drawOrder) {
      const n = entry.n;
      const m = metricsFor(n, state.windowId);
      const attention = (typeof m.attention_score === "number") ? m.attention_score : 0;
      const realization = (typeof m.realization_score === "number") ? m.realization_score : 1;
      const contradiction = (typeof m.contradiction_score === "number") ? m.contradiction_score : 0;

      const p = projectNode(n.x, n.y, n.z);
      const r = radiusFor(n) * (0.7 + 0.3 * state.zoom);

      let alpha = 1.0;
      if (focused) {
        alpha = related.has(n.id) ? 1.0 : 0.22;
      }

      // Fill via radial gradient (core brighter than rim)
      const coreColor = heatColor(Math.min(1, attention + 0.15));
      const rimColor = heatColor(attention * 0.85);
      const grad = ctx.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r);
      grad.addColorStop(0, withAlpha(coreColor, alpha));
      grad.addColorStop(1, withAlpha(rimColor, alpha));

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Outer rim / type outline
      ctx.lineWidth = (n.type === "category") ? 2 : 1.25;
      ctx.strokeStyle = withAlpha("#d8e7f7", 0.28 * alpha);
      ctx.stroke();

      // Selected halo
      if (state.selectedNodeId === n.id) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha("#18c7d8", 0.85);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Contradiction ring (purple/red) — legacy data only.
      if (contradiction >= CONTRADICT_T) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha("#c74bd8", 0.95 * alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Decide the center badge:
      //   no evidence yet      → 'new' tag (accent-cyan)
      //   realization < 0.25   → '!' + pulsing red outline
      //   realization < 0.40   → '!'
      //   otherwise            → nothing
      if (!hasEvidence(m)) {
        // "new" badge — no evidence in this window yet.
        const w = r * 1.6;
        const h = r * 0.9;
        ctx.fillStyle = withAlpha("#07111f", 0.88 * alpha);
        roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, Math.min(4, h / 2));
        ctx.fill();
        ctx.strokeStyle = withAlpha("#18c7d8", 0.9 * alpha);
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = withAlpha("#18c7d8", alpha);
        ctx.font = `700 ${Math.round(r * 0.55)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("new", p.x, p.y + 1);
      } else if (realization < WARN_T) {
        if (realization < WARN_STRONG_T) {
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 5 + pulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha("#ff4d2e", (0.45 + 0.5 * pulse) * alpha);
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
        ctx.fillStyle = withAlpha("#07111f", 0.85 * alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = withAlpha("#ffffff", alpha);
        ctx.font = `bold ${Math.round(r * 0.95)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", p.x, p.y + 1);
      }
    }

    // Trigger continuous redraw if any pulsing warnings exist
    if (anyPulsing()) scheduleDraw();
  }

  // Subtle origin marker: concentric dashed ring + crosshair.
  // Sits at the world (cx, cy) which — after projection — is always at
  // (cx + pan.x, cy + pan.y), independent of rotation.
  function drawCenterMarker(ctx) {
    const cx = state.width / 2 + state.pan.x;
    const cy = state.height / 2 + state.pan.y;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(130, 170, 210, 0.28)";
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(130, 170, 210, 0.22)";
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
    ctx.stroke();
    ctx.fillStyle = "rgba(24, 199, 216, 0.55)";
    ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function anyPulsing() {
    for (const n of state.renderNodes) {
      const m = metricsFor(n, state.windowId);
      // Only pulse when the node has evidence but low realization —
      // unvalidated ("new") nodes should stay calm.
      if (hasEvidence(m) && (m.realization_score ?? 1) < WARN_STRONG_T) return true;
    }
    return false;
  }

  // Canvas roundRect polyfill for the "new" pill background.
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function withAlpha(color, a) {
    if (color.startsWith("rgb(")) {
      return color.replace("rgb(", "rgba(").replace(")", `,${a})`);
    }
    // hex
    const rgb = hexToRgb(color);
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
  }

  function relatedIds(focusedId) {
    const set = new Set([focusedId]);
    const node = nodeById(focusedId);
    if (!node) return set;
    for (const p of node.parent_ids || []) set.add(p);
    for (const c of node.child_ids || []) set.add(c);
    // Also links
    for (const l of state.renderLinks) {
      const s = linkEndId(l.source), t = linkEndId(l.target);
      if (s === focusedId) set.add(t);
      if (t === focusedId) set.add(s);
    }
    return set;
  }

  /* ---------------- Labels overlay ---------------- */

  function drawLabels() {
    const layer = document.getElementById("label-layer");
    if (!layer) return;

    // Simple strategy: wipe-and-rewrite. Cheap enough for our scale.
    // For higher scales consider diffing by id.
    layer.innerHTML = "";
    for (const n of state.renderNodes) {
      if (!labelVisibleForNode(n, state.zoom)) continue;
      const p = projectNode(n.x, n.y, n.z);
      const r = radiusFor(n) * (0.7 + 0.3 * state.zoom);

      const div = document.createElement("div");
      div.className = `node-label ${labelClassFor(n.type)}`;
      div.textContent = labelTextFor(n);
      div.style.left = p.x + "px";
      div.style.top = (p.y + r + 4) + "px";
      layer.appendChild(div);
    }
  }
  function labelClassFor(t) {
    if (t === "category") return "cat";
    if (t === "theme") return "th";
    if (t === "subtheme") return "sub";
    return "pred";
  }
  function labelTextFor(n) {
    const t = n.short_label || n.label || n.id;
    if (n.type === "prediction") {
      return t.length > 32 ? t.slice(0, 32) + "…" : t;
    }
    return t;
  }

  /* ---------------- Hit-test ---------------- */

  function nodeAt(clientX, clientY) {
    // Check front-most first (highest z) so the node visibly on top wins.
    const candidates = state.renderNodes
      .map((n) => ({ n, p: projectNode(n.x, n.y, n.z) }))
      .sort((a, b) => b.p.z - a.p.z);
    for (const { n, p } of candidates) {
      const r = radiusFor(n) * (0.7 + 0.3 * state.zoom) + 2;
      const dx = clientX - p.x, dy = clientY - p.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  /* ---------------- Interaction ---------------- */

  function installEventHandlers() {
    const canvas = state.canvas;

    // Wheel zoom
    canvas.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * 0.001);
      const newZoom = clamp(state.zoom * factor, 0.3, 4.0);
      // Zoom toward cursor
      const cx = state.width / 2 + state.pan.x;
      const cy = state.height / 2 + state.pan.y;
      const mx = ev.clientX, my = ev.clientY;
      state.pan.x += (mx - cx) * (1 - newZoom / state.zoom);
      state.pan.y += (my - cy) * (1 - newZoom / state.zoom);
      state.zoom = newZoom;

      // Re-filter visible nodes if crossed a reveal threshold
      rebuildSimulation();
      scheduleDraw();
    }, { passive: false });

    // Pointer down
    canvas.addEventListener("pointerdown", (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      state.isPointerDown = true;
      state.pointerStart = { x: ev.clientX, y: ev.clientY };
      state.pointerCurrent = { x: ev.clientX, y: ev.clientY };
      state.axisLocked = null;

      const hit = nodeAt(ev.clientX, ev.clientY);
      if (hit) {
        state.draggingNode = hit;
        hit.fx = hit.x; hit.fy = hit.y;
        // Record screen-space offset between pointer and the node's
        // currently-projected center, so the node doesn't jump to the
        // cursor when you grab the edge.
        const proj = projectNode(hit.x, hit.y, hit.z);
        state.dragOffset = { dx: ev.clientX - proj.x, dy: ev.clientY - proj.y };
        state.simulation && state.simulation.alphaTarget(0.3).restart();
        canvas.classList.add("dragging");
      } else {
        state.draggingNode = null;
        state.dragOffset = null;
        // Shift or held-space temporarily flips the empty-space drag tool.
        const temp = ev.shiftKey || state.spaceHeld;
        const effective = temp ? (state.tool === "pan" ? "rotate" : "pan") : state.tool;
        state.panMode = (effective === "pan");
        canvas.classList.add(state.panMode ? "panning" : "dragging");
      }
    });

    canvas.addEventListener("pointermove", (ev) => {
      state.pointerCurrent = { x: ev.clientX, y: ev.clientY };

      // Hover feedback: show pointer cursor when over a node.
      if (!state.isPointerDown) {
        const hover = nodeAt(ev.clientX, ev.clientY);
        canvas.classList.toggle("over-node", !!hover);
        return;
      }

      const dx = ev.clientX - state.pointerStart.x;
      const dy = ev.clientY - state.pointerStart.y;

      if (state.draggingNode) {
        // Drag: un-project the screen position the node center should be
        // at (pointer - stored offset) back into world coords. This stays
        // correct under any rotation or zoom — the node tracks your finger
        // instead of flying off when the plane is tilted.
        const targetScreenX = ev.clientX - (state.dragOffset ? state.dragOffset.dx : 0);
        const targetScreenY = ev.clientY - (state.dragOffset ? state.dragOffset.dy : 0);
        const world = unprojectScreen(targetScreenX, targetScreenY, state.draggingNode.z);
        state.draggingNode.fx = world.x;
        state.draggingNode.fy = world.y;
        scheduleDraw();
        return;
      }

      if (state.panMode) {
        // Pan
        state.pan.x += ev.movementX || 0;
        state.pan.y += ev.movementY || 0;
        scheduleDraw();
        return;
      }

      // Rotate (UI §9.2): axis lock after 8px
      if (!state.axisLocked && Math.hypot(dx, dy) > 8) {
        state.axisLocked = Math.abs(dx) > Math.abs(dy) ? "y" : "x";
      }
      if (state.axisLocked === "y") {
        state.rotation.y += (ev.movementX || 0) * 0.005;
      } else if (state.axisLocked === "x") {
        state.rotation.x += (ev.movementY || 0) * 0.005;
      }
      scheduleDraw();
    });

    const endDrag = (ev) => {
      if (!state.isPointerDown) return;
      state.isPointerDown = false;
      canvas.classList.remove("dragging", "panning");

      if (state.draggingNode) {
        // Elastic release: keep some velocity, then release fx/fy (UI §9.1)
        const n = state.draggingNode;
        n.fx = null; n.fy = null;
        // Impart velocity based on recent pointer motion
        n.vx = (ev.movementX || 0) * 0.6;
        n.vy = (ev.movementY || 0) * 0.6;
        state.simulation && state.simulation.alphaTarget(0).alpha(0.35).restart();
        state.draggingNode = null;
        state.dragOffset = null;

        // Treat as click if barely moved
        const moved = Math.hypot(
          (state.pointerCurrent.x - state.pointerStart.x),
          (state.pointerCurrent.y - state.pointerStart.y)
        );
        if (moved < 4) handleNodeClick(n);
      } else {
        // Treat as click on empty if barely moved (close panel)
        const moved = Math.hypot(
          (state.pointerCurrent.x - state.pointerStart.x),
          (state.pointerCurrent.y - state.pointerStart.y)
        );
        if (moved < 4 && state.selectedNodeId) {
          // click on empty = deselect
          state.selectedNodeId = null;
          state.focusedNodeId = null;
          closeDetailPanel();
          scheduleDraw();
        }
      }
      state.panMode = false;
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    // Keyboard
    window.addEventListener("keydown", (ev) => {
      if (ev.key === " " || ev.code === "Space") state.spaceHeld = true;
      if (ev.key === "Escape") {
        state.selectedNodeId = null;
        state.focusedNodeId = null;
        closeDetailPanel();
        scheduleDraw();
      }
    });
    window.addEventListener("keyup", (ev) => {
      if (ev.key === " " || ev.code === "Space") state.spaceHeld = false;
    });

    // Resize
    window.addEventListener("resize", () => {
      resizeCanvas();
      if (state.simulation) {
        const cx = state.width / 2, cy = state.height / 2;
        state.simulation.force("x", d3.forceX(cx).strength(0.08));
        state.simulation.force("y", d3.forceY(cy).strength(0.08));
        state.simulation.alpha(0.3).restart();
      }
      scheduleDraw();
    });

    // Menu
    document.querySelectorAll(".menu-btn[data-scope]").forEach((btn) => {
      btn.addEventListener("click", () => selectScope(btn.dataset.scope));
    });
    document.querySelectorAll(".menu-btn[data-window]").forEach((btn) => {
      btn.addEventListener("click", () => selectWindow(btn.dataset.window));
    });
    document.querySelectorAll(".menu-btn[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => selectTool(btn.dataset.tool));
    });
    const catAll  = document.getElementById("cat-all");
    const catNone = document.getElementById("cat-none");
    if (catAll)  catAll.addEventListener("click",  () => setAllCategories(true));
    if (catNone) catNone.addEventListener("click", () => setAllCategories(false));

    // Panel close
    document.getElementById("panel-close").addEventListener("click", () => {
      state.selectedNodeId = null;
      state.focusedNodeId = null;
      closeDetailPanel();
      scheduleDraw();
    });
  }

  /* ---------------- Node click / focus ---------------- */

  function handleNodeClick(n) {
    state.selectedNodeId = n.id;
    state.focusedNodeId = n.id;
    openDetailPanel(n);
    scheduleDraw();
  }

  /* ---------------- Menu ---------------- */

  async function selectScope(scopeId) {
    if (!scopeId || scopeId === state.scopeId) return;
    updateScopeButtons(scopeId);
    state.scopeId = scopeId;
    saveState();
    updateMetaHeader();

    try {
      await loadScopeGraph(scopeId);
    } catch (e) {
      setStatus("failed to load " + scopeId + ": " + e.message, true);
      return;
    }
    setStatus("");

    // Keep selected node if present in new scope, else clear
    const stillPresent = state.selectedNodeId && nodeById(state.selectedNodeId);
    if (!stillPresent) {
      state.selectedNodeId = null;
      state.focusedNodeId = null;
      closeDetailPanel();
    }
    rebuildCategoryFilters();
    rebuildSimulation();
    if (stillPresent) openDetailPanel(nodeById(state.selectedNodeId));
  }

  function selectWindow(windowId) {
    if (!windowId || windowId === state.windowId) return;
    updateWindowButtons(windowId);
    state.windowId = windowId;
    saveState();
    updateMetaHeader();

    // UI §4.2: window change must NOT re-fetch graph file.
    // Just re-draw + refresh panel metrics.
    scheduleDraw();
    if (state.selectedNodeId) {
      const n = nodeById(state.selectedNodeId);
      if (n) openDetailPanel(n);
    }
  }

  function updateScopeButtons(scopeId) {
    document.querySelectorAll(".menu-btn[data-scope]").forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.dataset.scope === scopeId));
    });
  }
  function updateWindowButtons(windowId) {
    document.querySelectorAll(".menu-btn[data-window]").forEach((btn) => {
      btn.setAttribute("aria-checked", String(btn.dataset.window === windowId));
    });
  }
  function rebuildCategoryFilters() {
    const holder = document.getElementById("category-filters");
    if (!holder) return;
    holder.innerHTML = "";
    const g = currentGraph();
    if (!g) return;
    const cats = g.nodes.filter((n) => n.type === "category");
    cats.sort((a, b) => {
      const aa = (a.short_label || a.label || a.id).toLowerCase();
      const bb = (b.short_label || b.label || b.id).toLowerCase();
      return aa.localeCompare(bb);
    });
    const hidden = currentHidden();
    for (const c of cats) {
      const btn = document.createElement("button");
      btn.className = "menu-btn cat-filter";
      btn.dataset.category = c.id;
      btn.setAttribute("aria-pressed", String(!hidden.has(c.id)));
      btn.textContent = c.short_label || c.label || c.id;
      btn.title = c.label || c.id;
      btn.addEventListener("click", () => toggleCategory(c.id));
      holder.appendChild(btn);
    }
  }

  function toggleCategory(catId) {
    const hidden = currentHidden();
    if (hidden.has(catId)) hidden.delete(catId); else hidden.add(catId);
    const btn = document.querySelector(`.menu-btn.cat-filter[data-category="${CSS.escape(catId)}"]`);
    if (btn) btn.setAttribute("aria-pressed", String(!hidden.has(catId)));
    saveState();
    rebuildSimulation();
    scheduleDraw();
  }

  function setAllCategories(visible) {
    const hidden = currentHidden();
    const g = currentGraph();
    if (!g) return;
    hidden.clear();
    if (!visible) {
      for (const n of g.nodes) if (n.type === "category") hidden.add(n.id);
    }
    rebuildCategoryFilters();
    saveState();
    rebuildSimulation();
    scheduleDraw();
  }

  function updateToolButtons(tool) {
    document.querySelectorAll(".menu-btn[data-tool]").forEach((btn) => {
      btn.setAttribute("aria-checked", String(btn.dataset.tool === tool));
    });
    document.body.setAttribute("data-tool", tool);
    const hint = document.getElementById("hint-tool");
    if (hint) hint.textContent = tool === "pan" ? "empty drag: pan" : "empty drag: rotate";
  }

  function selectTool(tool) {
    if (tool !== "pan" && tool !== "rotate") return;
    if (tool === state.tool) return;
    state.tool = tool;
    updateToolButtons(tool);
    saveState();
  }

  /* ---------------- Detail panel ---------------- */

  function openDetailPanel(n) {
    const el = document.getElementById("detail-panel");
    const body = document.getElementById("panel-body");
    const title = document.getElementById("panel-title");
    const subtitle = document.getElementById("panel-subtitle");
    const typeEl = document.getElementById("panel-type");

    const detail = n.detail || {};
    typeEl.textContent = `${n.type} · ${n.scope_id || state.scopeId}`;
    title.textContent = detail.title || n.label || n.id;
    subtitle.textContent = detail.subtitle || subtitleFor(n);

    body.innerHTML = renderPanelBody(n);

    // Attach related-click handlers
    body.querySelectorAll("[data-goto]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.goto;
        const target = nodeById(id);
        if (target) handleNodeClick(target);
      });
    });

    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("panel-open");
  }

  function closeDetailPanel() {
    const el = document.getElementById("detail-panel");
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    document.body.classList.remove("panel-open");
  }

  function subtitleFor(n) {
    const parts = [];
    if (n.category_id) parts.push(n.category_id.split(".").pop());
    if (n.theme_id && n.theme_id !== n.id) parts.push(n.theme_id.split(".").pop());
    if (n.subtheme_id && n.subtheme_id !== n.id) parts.push(n.subtheme_id.split(".").pop());
    return parts.join(" / ");
  }

  function renderPanelBody(n) {
    const m = metricsFor(n, state.windowId);
    const pct = (v) => (typeof v === "number" ? (v * 100).toFixed(0) + "%" : "—");

    let extras = "";
    const detail = n.detail || {};

    // Common description
    const desc = detail.description || n.description || "";
    const statusPills = renderStatusPills(m);

    // Metrics block.
    //   Attention    — how much this theme/category was cited in the
    //                  validation reports inside the window, weighted by
    //                  the relevance score attached to each citation.
    //   Realization  — mean observed relevance (1-5 → 0.2-1.0) across
    //                  evidence in the window, weighted 0.65 new + 0.35
    //                  continuing. Reflects "is this prediction actually
    //                  playing out" — low means unrealized.
    //   Daily level  — today's grass cell level (0-4), for quick read.
    const attTip = "How often this topic was cited (frequency × relevance) in the window";
    const realTip = "Weighted mean observed relevance (0.65 * new + 0.35 * continuing)";
    const grassTip = "Today's daily-activity level (0-4, drives the strip below)";
    const mm = `
      <div class="metrics-grid">
        ${metricTile("Attention",    m.attention_score,   undefined, attTip)}
        ${metricTile("Realization",  m.realization_score, undefined, realTip)}
        ${metricTile("Daily level",  typeof m.grass_level === "number" ? m.grass_level / 4 : 0, m.grass_level, grassTip)}
      </div>
    `;

    // Grass strip
    const strip = renderGrassStrip(m);

    // Type-specific
    if (n.type === "category") {
      const themes = (n.child_ids || []).map((id) => nodeById(id)).filter(Boolean);
      extras = `
        <h3>Child themes (${themes.length})</h3>
        <ul class="related-list">${themes.map(listItem).join("") || '<li class="muted">none</li>'}</ul>
        ${detail.active_theme_count != null ? `<p class="muted">active theme count: ${detail.active_theme_count}</p>` : ""}
      `;
    } else if (n.type === "theme") {
      const parentCat = n.parent_ids && n.parent_ids[0] ? nodeById(n.parent_ids[0]) : null;
      const subs = (n.child_ids || []).map((id) => nodeById(id)).filter(Boolean);
      const preds = subs.flatMap((s) => (s.child_ids || []).map((id) => nodeById(id))).filter(Boolean);
      extras = `
        ${parentCat ? `<h3>Parent category</h3><ul class="related-list">${listItem(parentCat)}</ul>` : ""}
        <h3>Subthemes (${subs.length})</h3>
        <ul class="related-list">${subs.map(listItem).join("") || '<li class="muted">none</li>'}</ul>
        ${preds.length ? `<h3>Prediction summaries (${preds.length})</h3>
          <ul class="related-list">${preds.map(listItem).join("")}</ul>` : ""}
        ${renderEvidenceSummary(detail)}
      `;
    } else if (n.type === "subtheme") {
      const parentTheme = n.parent_ids && n.parent_ids[0] ? nodeById(n.parent_ids[0]) : null;
      const parentCat   = parentTheme ? (parentTheme.parent_ids || []).map(nodeById).filter(Boolean)[0] : null;
      const preds = (n.child_ids || []).map((id) => nodeById(id)).filter(Boolean);
      extras = `
        ${parentCat ? `<h3>Category</h3><ul class="related-list">${listItem(parentCat)}</ul>` : ""}
        ${parentTheme ? `<h3>Theme</h3><ul class="related-list">${listItem(parentTheme)}</ul>` : ""}
        <h3>Prediction summaries (${preds.length})</h3>
        <ul class="related-list">${preds.map(listItem).join("") || '<li class="muted">none</li>'}</ul>
        ${renderEvidenceSummary(detail)}
      `;
    } else if (n.type === "prediction") {
      const parents = (n.parent_ids || []).map(nodeById).filter(Boolean);
      extras = `
        ${detail.full_prediction_summary || detail.summary ? `
          <h3>Full prediction</h3>
          <p>${escapeHTML(detail.full_prediction_summary || detail.summary)}</p>` : ""}
        ${detail.prediction_date ? `<p class="muted">prediction date: ${detail.prediction_date}</p>` : ""}
        ${parents.length ? `<h3>Lineage</h3>
          <ul class="related-list">${parents.map(listItem).join("")}</ul>` : ""}
        ${detail.source_report_path ? `<h3>Source report</h3><p>${repoLink(detail.source_report_path)}</p>` : ""}
        ${detail.validation_report_path ? `<h3>Validation report</h3><p>${repoLink(detail.validation_report_path)}</p>` : ""}
        ${renderEvidenceLinks(detail.evidence || detail.evidence_links)}
      `;
    }

    const stripHeader = renderGrassStripHeader(m);
    return `
      <div>${statusPills}</div>
      ${desc ? `<p style="margin-top:10px">${escapeHTML(desc)}</p>` : ""}
      <h3>Window · ${state.windowId}</h3>
      ${mm}
      <h3>${stripHeader}</h3>
      ${strip}
      ${extras}
    `;
  }

  function metricTile(k, v, override, tooltip) {
    const shown = (override !== undefined) ? override : (typeof v === "number" ? v.toFixed(2) : "—");
    const barPct = clamp((typeof v === "number" ? v : 0), 0, 1) * 100;
    const titleAttr = tooltip ? ` title="${escapeHTML(tooltip)}"` : "";
    return `
      <div class="metric"${titleAttr}>
        <div class="k">${k}</div>
        <div class="v">${shown}</div>
        <div class="bar"><span style="width:${barPct}%"></span></div>
      </div>
    `;
  }

  function renderStatusPills(m) {
    const pills = [];
    const isNew = !hasEvidence(m);
    if (isNew) {
      pills.push(`<span class="pill new">new · not yet validated</span>`);
    } else {
      if (m.status) pills.push(`<span class="pill">${m.status}</span>`);
      if (typeof m.realization_score === "number" && m.realization_score < WARN_T) {
        pills.push(`<span class="pill warn">low realization</span>`);
      }
    }
    // Contradiction axis is retired; pill only survives for legacy data
    // where the backend still emits a nonzero score.
    if (typeof m.contradiction_score === "number" && m.contradiction_score >= CONTRADICT_T) pills.push(`<span class="pill contradict">contradicted</span>`);
    return pills.join(" ");
  }

  function windowDays(windowId) {
    if (windowId === "7d") return 7;
    if (windowId === "30d") return 30;
    if (windowId === "90d") return 90;
    return 30;
  }

  function renderGrassStripHeader(m) {
    const arr = Array.isArray(m.grass_daily) ? m.grass_daily : [];
    const days = windowDays(state.windowId);
    if (arr.length === 0) return `Daily activity · no data in ${days}d window`;
    return `Daily activity · ${arr.length} day${arr.length === 1 ? "" : "s"} of data · last ${days}d`;
  }

  function renderGrassStrip(m) {
    // Real data: one cell per date the backend reports for the current
    // window. Days outside the window, or days with no cited evidence,
    // are rendered as empty cells so the strip still shows the full
    // window length and the reader can read "last activity was N days
    // ago" at a glance.
    const days = windowDays(state.windowId);
    const arr = Array.isArray(m.grass_daily) ? m.grass_daily : [];
    const byDate = new Map();
    for (const row of arr) if (row && row.date) byDate.set(row.date, row);

    // Anchor the strip to the latest-report date from the manifest so
    // every node's strip lines up temporally.
    const endISO = (state.manifest && state.manifest.latest_report_date) || null;
    const endDate = endISO ? new Date(endISO + "T00:00:00Z") : new Date();

    const cells = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      const lvl = row ? Math.max(0, Math.min(4, row.grass_level | 0)) : 0;
      const title = row
        ? `${iso} · lvl ${lvl} · attn ${(row.attention_score || 0).toFixed(2)}`
        : `${iso} · no activity`;
      cells.push(`<span data-lvl="${lvl}" title="${title}"></span>`);
    }
    return `<div class="grass-strip" data-days="${days}">${cells.join("")}</div>`;
  }

  function renderEvidenceSummary(detail) {
    const sup = detail.supporting_evidence_count;
    const con = detail.contradicting_evidence_count;
    if (sup == null && con == null) return "";
    return `
      <h3>Evidence summary</h3>
      <p class="muted">supporting: ${sup ?? "—"} · contradicting: ${con ?? "—"}</p>
    `;
  }

  function renderEvidenceLinks(list) {
    if (!Array.isArray(list) || !list.length) return "";
    return `
      <h3>Evidence (${list.length})</h3>
      <ul class="related-list evidence-list">
        ${list.map((e) => {
          const title = escapeHTML(e.title || e.source_name || e.url || "(untitled)");
          const url   = e.url ? escapeHTML(e.url) : "";
          const dir   = e.support_direction ? `<span class="rtype">${escapeHTML(e.support_direction)}</span>` : "";
          return `<li>${dir}${url ? `<a href="${url}" target="_blank" rel="noreferrer noopener">${title}</a>` : title}</li>`;
        }).join("")}
      </ul>
    `;
  }

  function listItem(n) {
    if (!n) return "";
    const label = escapeHTML(n.short_label || n.label || n.id);
    return `<li data-goto="${escapeHTML(n.id)}"><span class="rtype">${n.type}</span>${label}</li>`;
  }

  // Build a clickable link to a repo-relative path on GitHub.
  function repoLink(path) {
    if (!path) return "";
    // strip any leading "./" or "/"
    const rel = String(path).replace(/^\.?\/+/, "");
    const url = REPO_BLOB_URL + rel;
    return `<a class="repo-link" href="${escapeHTML(url)}" target="_blank" rel="noreferrer noopener">${escapeHTML(rel)}</a>`;
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------------- Boot ---------------- */

  async function boot() {
    state.canvas = document.getElementById("graph-canvas");
    state.ctx = state.canvas.getContext("2d");
    resizeCanvas();

    // Restore persisted state (nice-to-have)
    const saved = loadPersisted();
    if (saved) {
      if (saved.scopeId) state.scopeId = saved.scopeId;
      if (saved.windowId) state.windowId = saved.windowId;
      if (saved.tool === "pan" || saved.tool === "rotate") state.tool = saved.tool;
      if (saved.hidden && typeof saved.hidden === "object") {
        for (const [scope, arr] of Object.entries(saved.hidden)) {
          if (Array.isArray(arr)) state.hiddenByScope[scope] = new Set(arr);
        }
      }
    }

    try {
      await loadManifest();
      updateScopeButtons(state.scopeId);
      updateWindowButtons(state.windowId);
      updateToolButtons(state.tool);

      await loadScopeGraph(state.scopeId);
      rebuildCategoryFilters();
      rebuildSimulation();
      setStatus("");
      installEventHandlers();
    } catch (err) {
      console.error(err);
      setStatus("failed to load data: " + (err && err.message ? err.message : err), true);
    }
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
