use std::path::PathBuf;

use axum::{Json, Router, http::header, response::IntoResponse, routing::get};
use nunc_stans_gate::{GateCfg, build_router};
use serde_json::json;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn spawn(app: Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    format!("http://{addr}")
}

fn stub_engine() -> Router {
    Router::new()
        .route("/health", get(|| async { Json(json!({"engine": "stub-engine", "ok": true})) }))
        .route(
            "/self/commitments",
            get(|| async { Json(json!({"commitments": [], "malformed_skipped": 0})) }),
        )
}

fn stub_fourfive() -> Router {
    Router::new()
        .route("/api/health", get(|| async { Json(json!({"ok": true, "provider": "stub"})) }))
        .route(
            "/api/stream",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "text/event-stream")],
                    "data: one\n\ndata: two\n\n",
                )
                    .into_response()
            }),
        )
}

/// Two throwaway dist dirs so the static mounts and the SPA fallback are real.
fn make_dists() -> (PathBuf, PathBuf) {
    let base = std::env::temp_dir().join(format!("gate-test-{}", std::process::id()));
    let formans = base.join("formans");
    let fourfive = base.join("fourfive");
    std::fs::create_dir_all(&formans).unwrap();
    std::fs::create_dir_all(&fourfive).unwrap();
    std::fs::write(formans.join("index.html"), "FORMANS-INDEX").unwrap();
    std::fs::write(fourfive.join("index.html"), "FOURFIVE-INDEX").unwrap();
    (formans, fourfive)
}

async fn spawn_gate() -> String {
    let engine = spawn(stub_engine()).await;
    let fourfive = spawn(stub_fourfive()).await;
    let (formans_dist, fourfive_dist) = make_dists();
    let cfg = GateCfg::new(engine, fourfive);
    spawn(build_router(cfg, &formans_dist, &fourfive_dist)).await
}

/// Raw HTTP/1.1 request so the Host header is fully under test control.
async fn raw_get(base: &str, path: &str, host: &str) -> String {
    let addr = base.trim_start_matches("http://");
    let mut s = tokio::net::TcpStream::connect(addr).await.unwrap();
    s.write_all(
        format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n").as_bytes(),
    )
    .await
    .unwrap();
    let mut buf = Vec::new();
    s.read_to_end(&mut buf).await.unwrap();
    String::from_utf8_lossy(&buf).into_owned()
}

#[tokio::test]
async fn engine_routes_round_trip() {
    let gate = spawn_gate().await;
    let health = reqwest::get(format!("{gate}/health")).await.unwrap().text().await.unwrap();
    assert!(health.contains("stub-engine"), "got: {health}");
    let commitments =
        reqwest::get(format!("{gate}/self/commitments")).await.unwrap().text().await.unwrap();
    assert!(commitments.contains("\"commitments\""), "got: {commitments}");
}

#[tokio::test]
async fn fourfive_prefix_is_stripped() {
    let gate = spawn_gate().await;
    let health =
        reqwest::get(format!("{gate}/fourfive/api/health")).await.unwrap().text().await.unwrap();
    assert!(health.contains("\"provider\":\"stub\""), "got: {health}");
}

#[tokio::test]
async fn sse_passes_through_with_content_type() {
    let gate = spawn_gate().await;
    let resp = reqwest::get(format!("{gate}/fourfive/api/stream")).await.unwrap();
    let ct = resp.headers()[header::CONTENT_TYPE].to_str().unwrap().to_owned();
    assert!(ct.starts_with("text/event-stream"), "content-type: {ct}");
    let body = resp.text().await.unwrap();
    assert!(body.contains("data: one") && body.contains("data: two"), "got: {body}");
}

#[tokio::test]
async fn static_mounts_and_spa_fallback() {
    let gate = spawn_gate().await;
    let ff = reqwest::get(format!("{gate}/fourfive/")).await.unwrap().text().await.unwrap();
    assert!(ff.contains("FOURFIVE-INDEX"), "got: {ff}");
    // Unknown client-side route falls back to the formans index (vue-router).
    let spa = reqwest::get(format!("{gate}/timeline")).await.unwrap().text().await.unwrap();
    assert!(spa.contains("FORMANS-INDEX"), "got: {spa}");
}

#[tokio::test]
async fn foreign_host_is_refused() {
    let gate = spawn_gate().await;
    let refused = raw_get(&gate, "/health", "evil.example").await;
    assert!(refused.starts_with("HTTP/1.1 403"), "got: {refused}");
    let allowed = raw_get(&gate, "/gate/health", "localhost").await;
    assert!(allowed.starts_with("HTTP/1.1 200"), "got: {allowed}");
}

#[tokio::test]
async fn upstream_down_is_a_502_with_advice() {
    let (formans_dist, fourfive_dist) = make_dists();
    // Point at ports where nothing listens.
    let cfg = GateCfg::new(
        "http://127.0.0.1:1".to_owned(),
        "http://127.0.0.1:1".to_owned(),
    );
    let gate = spawn(build_router(cfg, &formans_dist, &fourfive_dist)).await;
    let resp = reqwest::get(format!("{gate}/health")).await.unwrap();
    assert_eq!(resp.status(), 502);
    let body = resp.text().await.unwrap();
    assert!(body.contains("just up"), "got: {body}");
}
