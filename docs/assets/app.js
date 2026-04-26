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

  // Zoom-driven progressive reveal. Inverted from the original UI
  // §7.1 spec: categories are the broad-bucket overview and stay
  // visible at every zoom level; themes / subthemes / predictions
  // appear as the user drills in. Reads natural ("supermarket
  // signage first, product shelves next").
  const ZOOM_THRESHOLDS = {
    showThemes:      0.75,
    showSubthemes:   1.25,
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
  // A prediction reads as "supported" when its realization score
  // clears the same bar prediction_status uses on the backend.
  const SUPPORT_T = 0.70;

  // A node is considered "new / unvalidated" in the current window when
  // it has no per-day activity entries — i.e. nothing cited this
  // prediction/theme yet. It's distinct from "low realization" (which
  // means we *did* see it but it landed poorly).
  function hasEvidence(m) {
    return Array.isArray(m && m.grass_daily) && m.grass_daily.length > 0;
  }

  // Bucket a 0..1 score into the same 5 discrete levels grass_level
  // uses (PRD §6.6) and return it normalized back to 0..1 so the
  // heat gradient lines up consistently across all three metrics.
  function toHeatBin(v) {
    if (v <= 0.05) return 0 / 4;
    if (v <= 0.25) return 1 / 4;
    if (v <= 0.50) return 2 / 4;
    if (v <= 0.75) return 3 / 4;
    return 4 / 4;
  }

  /* ---------------- State ---------------- */

  const state = {
    manifest: null,
    scopeId: "mix",
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

    // Which metric drives the node heat coloring. One of
    //   "attention"   — continuous attention_score   (0..1)
    //   "realization" — continuous realization_score (0..1)
    //   "grass"       — discrete  grass_level        (0..4, stepped to 5 bins)
    heatMetric: "attention",

    // Panel navigation history — ids of previously viewed nodes, most
    // recent last. Back button pops the stack.
    panelHistory: [],

    // Category visibility filter. Single Set shared across all scopes —
    // hiding tech.security persists when you switch to business or mix.
    // Stored as an array in localStorage under 'hidden'.
    hiddenCategories: new Set(),

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scopeId: state.scopeId,
        windowId: state.windowId,
        tool: state.tool,
        heatMetric: state.heatMetric,
        hidden: Array.from(state.hiddenCategories),
      }));
    } catch (_) { /* ignore */ }
  }

  function currentHidden() {
    return state.hiddenCategories;
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
    if (node.type === "category") return true;
    if (node.type === "theme") return zoom >= ZOOM_THRESHOLDS.showThemes;
    if (node.type === "subtheme") return zoom >= ZOOM_THRESHOLDS.showSubthemes;
    if (node.type === "prediction") return zoom >= ZOOM_THRESHOLDS.showPredictions;
    return true;
  }

  function labelVisibleForNode(node, zoom) {
    if (node.type === "prediction") return zoom >= ZOOM_THRESHOLDS.showPredictions;
    if (node.type === "subtheme") return zoom >= ZOOM_THRESHOLDS.showSubthemes;
    if (node.type === "theme") return zoom >= ZOOM_THRESHOLDS.showThemes;
    return true;  // categories: always
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

  function rebuildSimulation(opts) {
    const { preservePriorPositions = false } = opts || {};
    const g = currentGraph();
    if (!g) return;

    // Filter nodes/links by zoom visibility
    const visibleNodes = g.nodes.filter((n) => isVisibleAtZoom(n, state.zoom));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = (g.links || [])
      .filter((l) => visibleIds.has(linkEndId(l.source)) && visibleIds.has(linkEndId(l.target)))
      .map((l) => ({ ...l })); // shallow copy so d3 can mutate

    // Prepare render nodes — reuse existing positions if same id present.
    // When preservePriorPositions is on, we also PIN the prior nodes via
    // fx/fy so force rearrangement can't drag them while the newly added
    // nodes settle. Pins release after a short settle interval.
    const prior = new Map(state.renderNodes.map((n) => [n.id, n]));
    const newlyPinned = [];
    const rn = visibleNodes.map((n) => {
      const p = prior.get(n.id);
      const init = n.layout || {};
      const z = (p && typeof p.z === "number") ? p.z : zFor(n);
      const node = Object.assign({}, n, {
        x: p ? p.x : (typeof init.x === "number" ? init.x + state.width / 2 : state.width / 2 + (Math.random() - 0.5) * 60),
        y: p ? p.y : (typeof init.y === "number" ? init.y + state.height / 2 : state.height / 2 + (Math.random() - 0.5) * 60),
        z: z,
        vx: p ? p.vx : 0,
        vy: p ? p.vy : 0,
        fx: p ? p.fx : null,
        fy: p ? p.fy : null,
      });
      if (preservePriorPositions && p && node.fx == null && node.fy == null) {
        node.fx = node.x;
        node.fy = node.y;
        node._scopeSwitchPin = true;
        newlyPinned.push(node);
      }
      return node;
    });
    state.renderNodes = rn;
    state.renderLinks = visibleLinks;

    if (state.simulation) state.simulation.stop();

    // Strength multiplier: when we're preserving an earlier view
    // (scope switch), push every force down dramatically so the
    // new scope's nodes drift into space rather than yanking
    // the entire existing layout around.
    const k = preservePriorPositions ? 0.2 : 1.0;

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
      .strength(0.35 * k);

    const charge = d3.forceManyBody().strength((d) => {
      const base =
        d.type === "category" ? -420 :
        d.type === "theme"    ? -300 :
        d.type === "subtheme" ? -160 :
                                -90;
      return base * k;
    });

    const cx = state.width / 2, cy = state.height / 2;
    const pullX = d3.forceX(cx).strength(0.08 * k);
    const pullY = d3.forceY(cy).strength(0.08 * k);
    const collide = d3.forceCollide().radius((d) => radiusFor(d) + 6).strength(0.85);

    state.simulation = d3.forceSimulation(rn)
      .force("link", linkForce)
      .force("charge", charge)
      .force("x", pullX)
      .force("y", pullY)
      .force("collide", collide)
      .alpha(preservePriorPositions ? 0.15 : 0.7)
      .alphaDecay(preservePriorPositions ? 0.08 : 0.03)
      .velocityDecay(0.35)
      .on("tick", scheduleDraw);

    // Scope-switch pins stay until the user explicitly drags a node
    // (pointerdown clears fx/fy on release), so the prior view
    // never drifts on its own. No auto-release timer.
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

      // Heat driver picks the metric the user selected. All three
      // modes are binned into the same 5 steps (PRD grass breakpoints:
      // 0.05 / 0.25 / 0.50 / 0.75) so a score of 0.62 reads the same
      // color whether you viewed it as attention or realization.
      let heatT = 0;
      if (state.heatMetric === "realization") {
        heatT = toHeatBin(typeof m.realization_score === "number" ? m.realization_score : 0);
      } else if (state.heatMetric === "grass") {
        const lvl = typeof m.grass_level === "number" ? m.grass_level : 0;
        heatT = Math.max(0, Math.min(4, lvl)) / 4;
      } else {
        heatT = toHeatBin(attention);
      }

      // Fill via radial gradient (core brighter than rim)
      const coreColor = heatColor(Math.min(1, heatT + 0.15));
      const rimColor = heatColor(heatT * 0.85);
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

      // Marker priority:
      //   no evidence yet                      → 'new' tag (cyan text)
      //   prediction with low realization      → center '!' (+ pulse)
      //   aggregate (cat/theme/sub) with weak  → corner badge with
      //                                          count of weak child
      //                                          *predictions*
      //   otherwise                            → nothing
      if (!hasEvidence(m)) {
        ctx.fillStyle = withAlpha("#18c7d8", alpha);
        ctx.font = "700 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("new", p.x, p.y + 1);
      } else if (n.type === "prediction" && realization < WARN_T) {
        // Predictions get the urgent center marker — it really does
        // mean "this item is weak".
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
      } else if (n.type !== "prediction") {
        // Aggregate: count descendant predictions that are doing
        // well. Reads as "N supported summaries under this group"
        // — a positive signal, not an alarm.
        const supported = countSupportedDescendantPredictions(n);
        if (supported > 0) {
          const bx = p.x + r * 0.75;
          const by = p.y - r * 0.75;
          // Very dark burnt-orange fill with a bright orange rim so
          // the badge reads clearly against both the cold graph
          // background and warm heatmap nodes around it.
          ctx.fillStyle = withAlpha("#2a0f03", 0.98 * alpha);
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = withAlpha("#e07a1a", 0.95 * alpha);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = withAlpha("#ffd8a0", alpha);
          ctx.font = "700 10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(supported), bx, by + 1);
        }
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
      if (n.type !== "prediction") continue; // only predictions pulse now
      const m = metricsFor(n, state.windowId);
      if (hasEvidence(m) && (m.realization_score ?? 1) < WARN_STRONG_T) return true;
    }
    return false;
  }

  // Walk child_ids transitively and count prediction descendants
  // matching a status predicate.
  function countDescendantPredictionsWhere(node, predicate) {
    const g = currentGraph();
    if (!g || !g._index) return 0;
    let n = 0;
    const stack = [node];
    const visited = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (visited.has(cur.id)) continue;
      visited.add(cur.id);
      if (cur.type === "prediction") {
        const m = metricsFor(cur, state.windowId);
        if (predicate(m)) n++;
        continue;
      }
      for (const cid of cur.child_ids || []) {
        const cn = g._index.get(cid);
        if (cn) stack.push(cn);
      }
    }
    return n;
  }

  function countSupportedDescendantPredictions(node) {
    return countDescendantPredictionsWhere(
      node,
      (m) => hasEvidence(m) && (m.realization_score ?? 0) >= SUPPORT_T,
    );
  }
  function countWeakDescendantPredictions(node) {
    return countDescendantPredictionsWhere(
      node,
      (m) => hasEvidence(m) && (m.realization_score ?? 1) < WARN_T,
    );
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
    // Highlight the focused node, every ancestor (transitive parents),
    // every descendant (transitive children), and any node directly
    // joined to the focused one by a link (catches shares_prediction
    // edges between categories that aren't in the parent/child tree).
    const set = new Set([focusedId]);
    const start = nodeById(focusedId);
    if (!start) return set;

    // Walk up through parent_ids
    const upStack = [...(start.parent_ids || [])];
    while (upStack.length) {
      const id = upStack.pop();
      if (set.has(id)) continue;
      set.add(id);
      const n = nodeById(id);
      if (n && n.parent_ids) for (const p of n.parent_ids) upStack.push(p);
    }
    // Walk down through child_ids
    const downStack = [...(start.child_ids || [])];
    while (downStack.length) {
      const id = downStack.pop();
      if (set.has(id)) continue;
      set.add(id);
      const n = nodeById(id);
      if (n && n.child_ids) for (const c of n.child_ids) downStack.push(c);
    }
    // Direct link neighbors (covers shares_prediction & friends)
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
      div.innerHTML = renderMarkdownInline(labelTextFor(n));
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
    if (n.type === "prediction") {
      // Predictions always need truncation; short_label is best.
      const t = n.short_label || n.label || n.id;
      return t.length > 32 ? t.slice(0, 32) + "…" : t;
    }
    // Themes / subthemes carry meaningful punctuation in their
    // canonical label (e.g. "1-bit / Edge LLM") that the seed
    // short_label sometimes drops. Prefer canonical to keep the
    // slash, hyphen, etc. Categories use short_label first since
    // their short forms are intentionally tight ("Runtime" vs
    // "Inference Runtime").
    if (n.type === "category") return n.short_label || n.label || n.id;
    return n.label || n.short_label || n.id;
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
          state.panelHistory.length = 0;
          updatePanelBackButton();
      updateFocusButton();
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
        state.panelHistory.length = 0;
        updatePanelBackButton();
      updateFocusButton();
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
    document.querySelectorAll(".menu-btn[data-heat]").forEach((btn) => {
      btn.addEventListener("click", () => selectHeatMetric(btn.dataset.heat));
    });
    const catAll   = document.getElementById("cat-all");
    const catNone  = document.getElementById("cat-none");
    const catFocus = document.getElementById("cat-focus");
    if (catAll)   catAll.addEventListener("click",   () => setAllCategories(true));
    if (catNone)  catNone.addEventListener("click",  () => setAllCategories(false));
    if (catFocus) catFocus.addEventListener("click", isolateHighlightedCategories);

    // Panel close / back
    document.getElementById("panel-close").addEventListener("click", () => {
      state.selectedNodeId = null;
      state.focusedNodeId = null;
      state.panelHistory.length = 0;
      updatePanelBackButton();
      updateFocusButton();
      closeDetailPanel();
      scheduleDraw();
    });
    document.getElementById("panel-back").addEventListener("click", navigateBack);
  }

  /* ---------------- Node click / focus ---------------- */

  function handleNodeClick(n) {
    // Push the current selection onto the history stack (unless it's
    // the same node we're already on — dedupe consecutive same-id
    // clicks). Navigation via back button calls handleNodeClick with
    // skipHistory=true via navigateBack().
    if (state.selectedNodeId && state.selectedNodeId !== n.id) {
      const hist = state.panelHistory;
      if (hist.length === 0 || hist[hist.length - 1] !== state.selectedNodeId) {
        hist.push(state.selectedNodeId);
        if (hist.length > 64) hist.shift(); // bound it
      }
    }
    state.selectedNodeId = n.id;
    state.focusedNodeId = n.id;
    openDetailPanel(n);
    updatePanelBackButton();
    updateFocusButton();
    scheduleDraw();
  }

  function navigateBack() {
    const hist = state.panelHistory;
    if (hist.length === 0) return;
    const prevId = hist.pop();
    const target = nodeById(prevId);
    if (target) {
      state.selectedNodeId = target.id;
      state.focusedNodeId = target.id;
      openDetailPanel(target);
    }
    updatePanelBackButton();
    updateFocusButton();
    scheduleDraw();
  }

  function updatePanelBackButton() {
    const btn = document.getElementById("panel-back");
    if (!btn) return;
    const canGoBack = state.panelHistory.length > 0;
    btn.disabled = !canGoBack;
    btn.title = canGoBack ? `Back to previous (${state.panelHistory.length} in history)` : "Back";
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
    rebuildSimulation({ preservePriorPositions: true });
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
    // ALL / NONE only affects the categories visible in the *current*
    // graph — other scopes keep whatever state they had. Since the
    // hidden set is shared, you can (e.g.) hide everything in tech
    // and still see business on BIZ, and the original tech state
    // returns when you swap back.
    const hidden = currentHidden();
    const g = currentGraph();
    if (!g) return;
    for (const n of g.nodes) {
      if (n.type !== "category") continue;
      if (visible) hidden.delete(n.id);
      else hidden.add(n.id);
    }
    rebuildCategoryFilters();
    saveState();
    rebuildSimulation();
    scheduleDraw();
  }

  // FOCUS: set the category filter so that only the categories
  // currently highlighted (= in relatedIds of the focused node)
  // remain visible. Other categories from the same scope go into
  // the hidden set; categories from other scopes are untouched
  // (they were already kept independent from this scope's filter).
  function isolateHighlightedCategories() {
    if (!state.focusedNodeId) return;
    const related = relatedIds(state.focusedNodeId);
    const g = currentGraph();
    if (!g) return;
    const hidden = currentHidden();
    for (const n of g.nodes) {
      if (n.type !== "category") continue;
      if (related.has(n.id)) hidden.delete(n.id);
      else hidden.add(n.id);
    }
    rebuildCategoryFilters();
    saveState();
    rebuildSimulation();
    scheduleDraw();
  }

  function updateFocusButton() {
    const btn = document.getElementById("cat-focus");
    if (!btn) return;
    if (!state.focusedNodeId) {
      btn.disabled = true;
      btn.textContent = "FOCUS";
      btn.title = "Select a node, then this hides every category not in its lineage";
      return;
    }
    // Show how many categories will stay visible if FOCUS is clicked.
    // If that count equals the total category count in the graph,
    // nothing would change — make the button look idle.
    const g = currentGraph();
    if (!g) return;
    const related = relatedIds(state.focusedNodeId);
    const cats = g.nodes.filter((n) => n.type === "category");
    const inFocus = cats.filter((c) => related.has(c.id));
    const total = cats.length;
    const keep = inFocus.length;
    btn.disabled = keep === 0 || keep === total;
    btn.textContent = "FOCUS";
    btn.title =
      keep === total
        ? `All ${total} categories already in this node's lineage — nothing to filter`
        : keep === 0
        ? "No category is in this node's lineage"
        : `Hide ${total - keep} of ${total} categories not in this node's lineage`;
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

  function updateHeatButtons(metric) {
    document.querySelectorAll(".menu-btn[data-heat]").forEach((btn) => {
      btn.setAttribute("aria-checked", String(btn.dataset.heat === metric));
    });
  }
  function selectHeatMetric(metric) {
    if (!["attention", "realization", "grass"].includes(metric)) return;
    if (metric === state.heatMetric) return;
    state.heatMetric = metric;
    updateHeatButtons(metric);
    saveState();
    scheduleDraw();
    // The detail panel's activity-chart background follows the
    // heat metric — re-render the open panel so the tint updates
    // without forcing the user to re-click the node.
    if (state.selectedNodeId) {
      const n = nodeById(state.selectedNodeId);
      if (n) openDetailPanel(n);
    }
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
    const statusPills = renderStatusPills(m, n);

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

    // Activity chart (was: grass strip)
    const strip = renderActivityChart(m);

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
          <div class="md-body">${renderMarkdown(detail.full_prediction_summary || detail.summary)}</div>` : ""}
        ${detail.prediction_date ? `<p class="muted">prediction date: ${detail.prediction_date}</p>` : ""}
        ${parents.length ? `<h3>Lineage</h3>
          <ul class="related-list">${parents.map(listItem).join("")}</ul>` : ""}
        ${detail.source_report_path ? `<h3>Source report</h3><p>${repoLink(detail.source_report_path)}</p>` : ""}
        ${renderValidationReports(detail)}
        ${renderEvidenceLinks(detail.evidence || detail.evidence_links)}
      `;
    }

    const stripHeader = renderGrassStripHeader(m);
    return `
      <div>${statusPills}</div>
      ${desc ? `<div class="md-body" style="margin-top:10px">${renderMarkdown(desc)}</div>` : ""}
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

  function renderStatusPills(m, n) {
    const pills = [];
    const isNew = !hasEvidence(m);
    if (isNew) {
      pills.push(`<span class="pill new">new · not yet validated</span>`);
    } else {
      if (m.status) pills.push(`<span class="pill">${m.status}</span>`);
      if (n && n.type !== "prediction") {
        // Aggregates — positive signal (how many summaries are
        // working) plus an optional weak count when it's meaningful.
        const supported = countSupportedDescendantPredictions(n);
        if (supported > 0) pills.push(`<span class="pill good">${supported} supported</span>`);
        const weak = countWeakDescendantPredictions(n);
        if (weak > 0) pills.push(`<span class="pill warn">${weak} weak</span>`);
      } else if (typeof m.realization_score === "number" && m.realization_score < WARN_T) {
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

  // Node's current heat value under the selected metric, mirroring the
  // logic in draw(). Used to tint the activity chart background.
  function nodeHeatT(m) {
    if (state.heatMetric === "realization") {
      return toHeatBin(typeof m.realization_score === "number" ? m.realization_score : 0);
    }
    if (state.heatMetric === "grass") {
      const lvl = typeof m.grass_level === "number" ? m.grass_level : 0;
      return Math.max(0, Math.min(4, lvl)) / 4;
    }
    return toHeatBin(typeof m.attention_score === "number" ? m.attention_score : 0);
  }

  // Inline SVG line chart of daily attention_score across the
  // selected window. Background tinted with the node's current heat
  // color so the panel reads as "this node, over time".
  function renderActivityChart(m) {
    const days = windowDays(state.windowId);
    const arr = Array.isArray(m.grass_daily) ? m.grass_daily : [];
    const byDate = new Map();
    for (const row of arr) if (row && row.date) byDate.set(row.date, row);

    const endISO = (state.manifest && state.manifest.latest_report_date) || null;
    const endDate = endISO ? new Date(endISO + "T00:00:00Z") : new Date();

    // One sample per day in window, with 0 for empty days.
    const samples = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      samples.push({
        date: iso,
        v: row ? Math.max(0, Math.min(1, row.attention_score || 0)) : 0,
        cited: !!row,
      });
    }

    // Layout — left padding holds y-axis labels.
    const W = 360, H = 78, pad = { l: 22, r: 4, t: 6, b: 14 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const xAt = (i) => pad.l + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW);
    const yAt = (v) => pad.t + (1 - v) * innerH;

    const heatT = nodeHeatT(m);
    const bg = heatColor(heatT);

    if (arr.length === 0) {
      const yTicksEmpty = [0, 1].map((v) => {
        const y = yAt(v);
        const label = v === 1 ? "1.0" : "0";
        return `<text x="${pad.l - 3}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(130,170,210,0.55)">${label}</text>`;
      }).join("");
      return `
        <div class="activity-chart" style="--bg:${bg};">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <line x1="${pad.l}" y1="${yAt(0)}" x2="${W - pad.r}" y2="${yAt(0)}"
                  stroke="rgba(130,170,210,0.35)" stroke-dasharray="2 4" stroke-width="1"/>
            ${yTicksEmpty}
          </svg>
          <div class="activity-empty">no activity in ${days}d</div>
        </div>`;
    }

    // Polyline path for the line; circles for cited days.
    const linePts = samples.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s.v).toFixed(1)}`).join(" ");
    const dots = samples
      .map((s, i) => s.cited
        ? `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(s.v).toFixed(1)}" r="2.4" fill="#e07a1a" />`
        : ""
      )
      .join("");

    // Sparse x-axis tick: first, middle, last date.
    const ticks = [];
    if (samples.length > 0) {
      const idxs = samples.length === 1 ? [0] : [0, Math.floor((samples.length - 1) / 2), samples.length - 1];
      for (const i of idxs) {
        const lab = samples[i].date.slice(5); // MM-DD
        ticks.push(`<text x="${xAt(i).toFixed(1)}" y="${H - 2}" text-anchor="${i === 0 ? "start" : i === samples.length - 1 ? "end" : "middle"}" font-size="9" fill="rgba(130,170,210,0.7)">${lab}</text>`);
      }
    }

    // Y-axis labels (0 / 0.5 / 1.0) on the left margin.
    const yTicks = [0, 0.5, 1].map((v) => {
      const y = yAt(v);
      const label = v === 1 ? "1.0" : v === 0.5 ? "0.5" : "0";
      return `<text x="${pad.l - 3}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(130,170,210,0.7)">${label}</text>`;
    }).join("");

    return `
      <div class="activity-chart" style="--bg:${bg};" title="Daily attention over the last ${days} days">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <line x1="${pad.l}" y1="${yAt(1)}" x2="${W - pad.r}" y2="${yAt(1)}" stroke="rgba(130,170,210,0.10)" stroke-dasharray="2 3" stroke-width="1"/>
          <line x1="${pad.l}" y1="${yAt(0.5)}" x2="${W - pad.r}" y2="${yAt(0.5)}" stroke="rgba(130,170,210,0.10)" stroke-dasharray="2 3" stroke-width="1"/>
          <line x1="${pad.l}" y1="${yAt(0)}" x2="${W - pad.r}" y2="${yAt(0)}" stroke="rgba(130,170,210,0.18)" stroke-width="1"/>
          ${yTicks}
          <polyline points="${linePts}" fill="none" stroke="#ffd8a0" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
          ${dots}
          ${ticks.join("")}
        </svg>
      </div>`;
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
      const lvl = row ? Ma