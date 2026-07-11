pub mod commitment_extract;
pub mod guard;
pub mod model_backend;
pub mod news_config;
pub mod profiles;
pub mod proxy;
pub mod runs;
pub mod topics;
pub mod world_run;

use std::path::{Path, PathBuf};

use axum::{
    Json, Router,
    body::Body,
    extract::{OriginalUri, Request, State},
    http::{StatusCode, header},
    middleware,
    response::{IntoResponse, Response},
    routing::{any, get},
};
use serde_json::{Value, json};
use tower::ServiceExt;
use tower_http::services::ServeDir;

/// Shared state: one plain-http client, the two loopback upstreams, and the
/// formans dist (the SPA fallback handler reads its index.html).
#[derive(Clone)]
pub struct GateCfg {
    pub client: reqwest::Client,
    pub engine_url: String,
    pub fourfive_url: String,
    /// apps-host base URL (Phase E): everything under /apps/ proxies there,
    /// prefix stripped — UI shell, per-app API, and the MCP endpoint alike.
    pub apps_url: String,
    pub formans_dist: PathBuf,
    /// User-designated data store (workspace model); carries the news
    /// settings file the config API serves. None ⇒ the API answers 503.
    pub data_dir: Option<PathBuf>,
    /// nunc-fluens instances home (PD13: an explicit handoff — the gate
    /// never derives engine layout). None ⇒ the run-log viewer serves
    /// the main store only.
    pub instances_dir: Option<PathBuf>,
    /// The linked nunc-fluens instance (the world-view source) — the
    /// explicit handoff the topics API writes into (`just up` resolves
    /// `news_repo` and passes it). None ⇒ the topics API answers 503.
    pub news_repo: Option<PathBuf>,
    /// Local model base URL (llama-server, OpenAI-compatible) for the
    /// topic NL-structuring proxy. Unreachable ⇒ the extract API 503s
    /// ("local model offline — just setup"). Env LLAMACPP_HOST overrides.
    pub llama_url: String,
    /// APP config file override (tests) — the model-backend settings API
    /// reads/writes `<config-home>/nunc-stans/config.json`; None resolves
    /// the real per-user path at request time.
    pub app_config_file: Option<PathBuf>,
    /// Installable-model catalog JSON (tools/model-catalog.json). None ⇒
    /// the install API accepts custom URLs only.
    pub model_catalog: Option<PathBuf>,
    /// The one in-flight model download (one at a time; progress polled).
    pub download: std::sync::Arc<std::sync::Mutex<Option<model_backend::DownloadJob>>>,
    /// The one in-flight World pipeline run (W-R1; one at a time).
    pub world_run: std::sync::Arc<std::sync::Mutex<Option<world_run::RunJob>>>,
}

impl GateCfg {
    pub fn new(engine_url: String, fourfive_url: String, formans_dist: PathBuf) -> Self {
        Self {
            client: reqwest::Client::new(),
            engine_url,
            fourfive_url,
            apps_url: "http://127.0.0.1:8788".to_owned(),
            formans_dist,
            data_dir: None,
            instances_dir: None,
            news_repo: None,
            llama_url: std::env::var("LLAMACPP_HOST")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".to_owned()),
            app_config_file: None,
            model_catalog: None,
            download: std::sync::Arc::new(std::sync::Mutex::new(None)),
            world_run: std::sync::Arc::new(std::sync::Mutex::new(None)),
        }
    }

    pub fn with_app_config_file(mut self, file: PathBuf) -> Self {
        self.app_config_file = Some(file);
        self
    }

    pub fn with_model_catalog(mut self, file: Option<PathBuf>) -> Self {
        self.model_catalog = file;
        self
    }

    pub fn with_llama_url(mut self, llama_url: String) -> Self {
        self.llama_url = llama_url;
        self
    }

    pub fn with_apps_url(mut self, apps_url: String) -> Self {
        self.apps_url = apps_url;
        self
    }

    pub fn with_data_dir(mut self, data_dir: Option<PathBuf>) -> Self {
        self.data_dir = data_dir;
        self
    }

    pub fn with_instances_dir(mut self, instances_dir: Option<PathBuf>) -> Self {
        self.instances_dir = instances_dir;
        self
    }

    pub fn with_news_repo(mut self, news_repo: Option<PathBuf>) -> Self {
        self.news_repo = news_repo;
        self
    }
}

/// The single-origin route table (first match wins):
///   /gate/health        the gate's own liveness
///   /api/*              gate-owned APIs (world, model-backend, profiles,
///                       runs); an /api path no route owns is an honest 404
///                       terminal, never the SPA fallback
///   /health, /self/*    → ledger engine (S-10 keeps proving gate→engine)
///   /fourfive/api/*     → fourfive server, `/fourfive` prefix stripped
///   /fourfive/**        fourfive dist (static; a missing asset is a 404)
///   /apps/**            → apps-host, `/apps` prefix stripped (Phase E:
///                       generated-app UI + API + MCP, one upstream)
///   everything else     formans dist; extensionless misses fall back to
///                       index.html (vue-router), file-like misses stay 404
///                       so probes (e.g. /world-graph/data/manifest.json)
///                       tell the truth.
pub fn build_router(cfg: GateCfg, fourfive_dist: &Path) -> Router {
    // nest_service, not nest: `nest` discards a nested router's fallback,
    // and the fourfive static mount lives in that fallback.
    let fourfive = Router::new()
        .route("/api/{*path}", any(proxy_fourfive))
        .fallback_service(ServeDir::new(fourfive_dist))
        .with_state(cfg.clone());
    Router::new()
        .route("/gate/health", get(gate_health))
        .route(
            "/api/world/news-config",
            get(news_config::get_news_config).put(news_config::put_news_config),
        )
        .route(
            "/api/world/topics",
            get(topics::get_topics).put(topics::put_topics),
        )
        .route("/api/world/topics/extract", axum::routing::post(topics::extract_topics))
        .route(
            "/api/world/run",
            get(world_run::get_run).post(world_run::post_run),
        )
        .route(
            "/api/self/commitment/extract",
            axum::routing::post(commitment_extract::extract_commitment),
        )
        .route(
            "/api/model-backend",
            get(model_backend::get_model_backend).put(model_backend::put_model_backend),
        )
        .route(
            "/api/model-backend/download",
            get(model_backend::get_download).post(model_backend::post_download),
        )
        .route(
            "/api/model-backend/restart",
            axum::routing::post(model_backend::post_restart),
        )
        .route("/api/profiles", get(profiles::list_profiles))
        .route(
            "/api/profiles/defaults",
            get(profiles::get_defaults).put(profiles::put_defaults),
        )
        .route(
            "/api/profiles/{id}",
            get(profiles::get_profile)
                .put(profiles::put_profile)
                .delete(profiles::delete_profile),
        )
        .route("/api/runs", get(runs::get_runs))
        .route("/api/runs/instances", get(runs::list_run_instances))
        // Unknown /api/* terminates HERE. Without these, bare API paths fell
        // through to the formans SPA fallback: a GET came back as index.html
        // with a 200 (the exact masquerade formans_static exists to prevent)
        // and a non-GET as ServeDir's bare 405 — found live 2026-07-10 by
        // POSTing /api/sessions (fourfive's API is at /fourfive/api/*).
        // All three spellings, same as /apps: the wildcard needs a segment.
        .route("/api", any(api_not_found))
        .route("/api/", any(api_not_found))
        .route("/api/{*path}", any(api_not_found))
        .route("/health", any(proxy_engine))
        .route("/self/{*path}", any(proxy_engine))
        // All three spellings: the axum wildcard needs a non-empty segment,
        // so bare "/apps" and "/apps/" (the index page) get literal routes —
        // otherwise they fall through to the formans SPA fallback. Bare
        // "/apps" redirects to "/apps/" so the index shell's relative assets
        // (./assets/*) resolve under the mount instead of at the origin root.
        .route("/apps", any(apps_trailing_redirect))
        .route("/apps/", any(proxy_apps))
        .route("/apps/{*path}", any(proxy_apps))
        .nest_service("/fourfive", fourfive)
        .fallback(formans_static)
        .with_state(cfg)
        .layer(middleware::from_fn(guard::require_local_host))
}

async fn gate_health() -> Json<Value> {
    Json(json!({
        "ok": true,
        "gate": "nunc-stans-gate",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Honest terminal for /api paths no gate route owns (see the route table).
async fn api_not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        "no such gate API — fourfive's API is at /fourfive/api/*, generated apps under /apps/*",
    )
        .into_response()
}

/// Static serving with an honest SPA fallback: only a path whose last
/// segment has no extension can fall back to index.html — an asset or data
/// probe that misses must 404, never masquerade as the app shell.
async fn formans_static(State(cfg): State<GateCfg>, req: Request) -> Response {
    let extensionless = !req
        .uri()
        .path()
        .rsplit('/')
        .next()
        .unwrap_or("")
        .contains('.');
    let served = ServeDir::new(&cfg.formans_dist)
        .oneshot(req)
        .await
        .expect("ServeDir is infallible");
    if served.status() == StatusCode::NOT_FOUND && extensionless {
        match tokio::fs::read(cfg.formans_dist.join("index.html")).await {
            Ok(bytes) => Response::builder()
                .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                .body(Body::from(bytes))
                .expect("static index response"),
            Err(_) => (
                StatusCode::NOT_FOUND,
                "formans dist has no index.html — run `just build`",
            )
                .into_response(),
        }
    } else {
        served.map(Body::new)
    }
}

async fn proxy_engine(State(cfg): State<GateCfg>, req: Request) -> Response {
    let pq = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str().to_owned())
        .unwrap_or_else(|| "/".to_owned());
    proxy::forward(&cfg.client, format!("{}{}", cfg.engine_url, pq), req).await
}

async fn proxy_fourfive(
    State(cfg): State<GateCfg>,
    OriginalUri(orig): OriginalUri,
    req: Request,
) -> Response {
    // Inside the nested service the request URI is prefix-stripped; the
    // original URI extension keeps the real path for the mount-aware rewrite.
    let pq = orig.path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let stripped = proxy::strip_mount(pq, "/fourfive");
    proxy::forward(&cfg.client, format!("{}{}", cfg.fourfive_url, stripped), req).await
}

/// Bare `/apps` → `/apps/` (308). The index shell loads its assets relative
/// (`./assets/*`); without the trailing slash the browser resolves them at the
/// origin root instead of under the mount, and the shell fails to boot.
async fn apps_trailing_redirect() -> Response {
    (StatusCode::PERMANENT_REDIRECT, [(header::LOCATION, "/apps/")]).into_response()
}

async fn proxy_apps(State(cfg): State<GateCfg>, req: Request) -> Response {
    let pq = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str().to_owned())
        .unwrap_or_else(|| "/".to_owned());
    let stripped = proxy::strip_mount(&pq, "/apps");
    let stripped = if stripped.is_empty() { "/" } else { stripped };
    proxy::forward(&cfg.client, format!("{}{}", cfg.apps_url, stripped), req).await
}
