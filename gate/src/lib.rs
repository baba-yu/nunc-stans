pub mod guard;
pub mod proxy;

use std::path::Path;

use axum::{
    Json, Router,
    extract::{OriginalUri, Request, State},
    middleware,
    response::Response,
    routing::{any, get},
};
use serde_json::{Value, json};
use tower_http::services::{ServeDir, ServeFile};

/// Shared proxy state: one plain-http client plus the two loopback upstreams.
#[derive(Clone)]
pub struct GateCfg {
    pub client: reqwest::Client,
    pub engine_url: String,
    pub fourfive_url: String,
}

impl GateCfg {
    pub fn new(engine_url: String, fourfive_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            engine_url,
            fourfive_url,
        }
    }
}

/// The single-origin route table (first match wins):
///   /gate/health        the gate's own liveness
///   /health, /self/*    → ledger engine (S-10 keeps proving gate→engine)
///   /fourfive/api/*     → fourfive server, `/fourfive` prefix stripped
///   /fourfive/**        fourfive dist (static)
///   everything else     formans dist with an index.html SPA fallback
pub fn build_router(cfg: GateCfg, formans_dist: &Path, fourfive_dist: &Path) -> Router {
    // nest_service, not nest: `nest` discards a nested router's fallback,
    // and the fourfive static mount lives in that fallback.
    let fourfive = Router::new()
        .route("/api/{*path}", any(proxy_fourfive))
        .fallback_service(ServeDir::new(fourfive_dist))
        .with_state(cfg.clone());
    Router::new()
        .route("/gate/health", get(gate_health))
        .route("/health", any(proxy_engine))
        .route("/self/{*path}", any(proxy_engine))
        .nest_service("/fourfive", fourfive)
        .fallback_service(
            ServeDir::new(formans_dist)
                .fallback(ServeFile::new(formans_dist.join("index.html"))),
        )
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
    // Inside `nest` the request URI is prefix-stripped; the original URI
    // extension keeps the real path for the mount-aware rewrite.
    let pq = orig.path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let stripped = proxy::strip_mount(pq, "/fourfive");
    proxy::forward(&cfg.client, format!("{}{}", cfg.fourfive_url, stripped), req).await
}
