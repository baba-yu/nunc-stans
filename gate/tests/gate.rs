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
/// One base per CALL, not per process: tests run concurrently, and a shared
/// index.html re-written by every caller (fs::write truncates first) was
/// intermittently served empty to the static-mount test.
fn make_dists() -> (PathBuf, PathBuf) {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static SEQ: AtomicUsize = AtomicUsize::new(0);
    let base = std::env::temp_dir().join(format!(
        "gate-test-{}-{}",
        std::process::id(),
        SEQ.fetch_add(1, Ordering::Relaxed)
    ));
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
    let cfg = GateCfg::new(engine, fourfive, formans_dist);
    spawn(build_router(cfg, &fourfive_dist)).await
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
    // A file-like miss must stay a 404 — probes (e.g. the world view's
    // manifest HEAD) must never be fooled by the SPA fallback.
    let miss = reqwest::get(format!("{gate}/world-graph/data/manifest.json")).await.unwrap();
    assert_eq!(miss.status(), 404);
    let asset = reqwest::get(format!("{gate}/assets/nope.js")).await.unwrap();
    assert_eq!(asset.status(), 404);
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
        formans_dist,
    );
    let gate = spawn(build_router(cfg, &fourfive_dist)).await;
    let resp = reqwest::get(format!("{gate}/health")).await.unwrap();
    assert_eq!(resp.status(), 502);
    let body = resp.text().await.unwrap();
    assert!(body.contains("just up"), "got: {body}");
}

// --- news settings API (Phase C T7) ---------------------------------------

#[tokio::test]
async fn news_config_roundtrip_and_validation() {
    let (formans_dist, fourfive_dist) = make_dists();
    let data_dir = formans_dist.parent().unwrap().join("data-store");
    let cfg = GateCfg::new(
        "http://127.0.0.1:1".into(),
        "http://127.0.0.1:1".into(),
        formans_dist.clone(),
    )
    .with_data_dir(Some(data_dir.clone()));
    let gate = spawn(build_router(cfg, &fourfive_dist)).await;
    let client = reqwest::Client::new();
    let url = format!("{gate}/api/world/news-config");

    // Unconfigured store file -> defaults (incl. the full locale trio).
    let got: serde_json::Value = client.get(&url).send().await.unwrap().json().await.unwrap();
    assert_eq!(got["runtime"], "claude-code");
    assert_eq!(got["search"], "native");
    assert_eq!(got["locales"], json!(["ja", "es", "fil"]));

    // PUT external pair -> stored atomically, GET round-trips.
    let put = client
        .put(&url)
        .json(&json!({"runtime": "ollama", "search": "external",
                      "searchEngine": "brave", "synthModel": "qwen3.6:27b"}))
        .send()
        .await
        .unwrap();
    assert_eq!(put.status(), 200);
    let file = data_dir.join("world/news-config.json");
    assert!(file.is_file(), "config file written");
    let got: serde_json::Value = client.get(&url).send().await.unwrap().json().await.unwrap();
    assert_eq!(got["searchEngine"], "brave");
    assert_eq!(got["synthModel"], "qwen3.6:27b");

    // external without an engine -> 422; unknown key -> 400.
    let bad = client.put(&url).json(&json!({"search": "external"})).send().await.unwrap();
    assert_eq!(bad.status(), 422);
    let unknown = client.put(&url).json(&json!({"serch": "native"})).send().await.unwrap();
    assert_eq!(unknown.status(), 400);
}

#[tokio::test]
async fn news_config_locales_subset_and_validation() {
    let (formans_dist, fourfive_dist) = make_dists();
    // Own store dir — the roundtrip test above shares the same base and
    // writes its own news-config.json concurrently.
    let data_dir = formans_dist.parent().unwrap().join("data-store-locales");
    let cfg = GateCfg::new(
        "http://127.0.0.1:1".into(),
        "http://127.0.0.1:1".into(),
        formans_dist.clone(),
    )
    .with_data_dir(Some(data_dir.clone()));
    let gate = spawn(build_router(cfg, &fourfive_dist)).await;
    let client = reqwest::Client::new();
    let url = format!("{gate}/api/world/news-config");

    // PUT a subset -> stored, GET round-trips it.
    let put = client.put(&url).json(&json!({"locales": ["ja"]})).send().await.unwrap();
    assert_eq!(put.status(), 200);
    let got: serde_json::Value = client.get(&url).send().await.unwrap().json().await.unwrap();
    assert_eq!(got["locales"], json!(["ja"]));

    // The empty set is a legitimate EN-only configuration.
    let put = client.put(&url).json(&json!({"locales": []})).send().await.unwrap();
    assert_eq!(put.status(), 200);
    let got: serde_json::Value = client.get(&url).send().await.unwrap().json().await.unwrap();
    assert_eq!(got["locales"], json!([]));

    // Outside the {ja, es, fil} universe -> 422 (value validation).
    let bad = client.put(&url).json(&json!({"locales": ["de"]})).send().await.unwrap();
    assert_eq!(bad.status(), 422);
    // Duplicate entry -> 422.
    let dup = client.put(&url).json(&json!({"locales": ["ja", "ja"]})).send().await.unwrap();
    assert_eq!(dup.status(), 422);
    // Unknown top-level key stays a body-shape 400 (deny_unknown_fields).
    let unknown = client.put(&url).json(&json!({"locale": ["ja"]})).send().await.unwrap();
    assert_eq!(unknown.status(), 400);
}

#[tokio::test]
async fn news_config_without_data_dir_is_503() {
    let (formans_dist, fourfive_dist) = make_dists();
    let cfg = GateCfg::new(
        "http://127.0.0.1:1".into(),
        "http://127.0.0.1:1".into(),
        formans_dist,
    );
    let gate = spawn(build_router(cfg, &fourfive_dist)).await;
    let resp = reqwest::get(format!("{gate}/api/world/news-config")).await.unwrap();
    assert_eq!(resp.status(), 503);
}

#[tokio::test]
async fn profiles_crud_defaults_and_rails() {
    let (formans_dist, fourfive_dist) = make_dists();
    let data_dir = formans_dist.parent().unwrap().join("data-store-profiles");
    let cfg = GateCfg::new(
        "http://127.0.0.1:1".into(),
        "http://127.0.0.1:1".into(),
        formans_dist.clone(),
    )
    .with_data_dir(Some(data_dir.clone()));
    let gate = spawn(build_router(cfg, &fourfive_dist)).await;
    let client = reqwest::Client::new();
    let base = format!("{gate}/api/profiles");

    // Empty store -> empty list, empty defaults.
    let list: serde_json::Value = client.get(&base).send().await.unwrap().json().await.unwrap();
    assert_eq!(list, json!([]));
    let defaults: serde_json::Value =
        client.get(format!("{base}/defaults")).send().await.unwrap().json().await.unwrap();
    assert_eq!(defaults, json!({}));

    // Create -> atomic file appears; GET/list round-trip.
    let local = json!({
        "id": "local-chat", "name": "Local chat", "provider": "ollama",
        "model": "qwen3.6:27b", "system_prompt": "be brief",
        "skills": ["memory"],
        "memory_scope": {"read": ["notes/*", "self/commitment/*"], "write": ["notes/*"]},
        "goal_verify": {"verify": "off", "maxIters": 2},
        "ui": {"accent": "cyan"}
    });
    let put = client.put(format!("{base}/local-chat")).json(&local).send().await.unwrap();
    assert_eq!(put.status(), 200);
    assert!(data_dir.join("profiles/local-chat.json").exists());
    let got: serde_json::Value =
        client.get(format!("{base}/local-chat")).send().await.unwrap().json().await.unwrap();
    assert_eq!(got["model"], "qwen3.6:27b");
    let list: serde_json::Value = client.get(&base).send().await.unwrap().json().await.unwrap();
    assert_eq!(list.as_array().unwrap().len(), 1);

    // F3 rail: write access to self-scope commitments cannot be saved.
    let f3 = json!({
        "id": "rogue", "name": "Rogue", "provider": "mock",
        "memory_scope": {"read": [], "write": ["self/commitment/x"]}
    });
    let denied = client.put(format!("{base}/rogue")).json(&f3).send().await.unwrap();
    assert_eq!(denied.status(), 422);
    assert!(denied.text().await.unwrap().contains("F3"));

    // BYOL rail: credential-shaped ui keys cannot be saved.
    let leaky = json!({
        "id": "leaky", "name": "Leaky", "provider": "mock",
        "ui": {"anthropicApiKey": "sk-nope"}
    });
    let denied = client.put(format!("{base}/leaky")).json(&leaky).send().await.unwrap();
    assert_eq!(denied.status(), 422);
    assert!(denied.text().await.unwrap().contains("credential-shaped"));

    // Unknown top-level field -> 400 (deny_unknown_fields).
    let unknown = client
        .put(format!("{base}/local-chat"))
        .json(&json!({"id": "local-chat", "name": "x", "provider": "p", "modle": "typo"}))
        .send()
        .await
        .unwrap();
    assert_eq!(unknown.status(), 400);
    // Body/url id mismatch -> 422.
    let mismatch = client
        .put(format!("{base}/other-id"))
        .json(&json!({"id": "local-chat", "name": "x", "provider": "p"}))
        .send()
        .await
        .unwrap();
    assert_eq!(mismatch.status(), 422);

    // Defaults: pointing at a missing profile is refused; a real one sticks.
    let bad = client
        .put(format!("{base}/defaults"))
        .json(&json!({"fourfive-chat": "ghost"}))
        .send()
        .await
        .unwrap();
    assert_eq!(bad.status(), 422);
    let ok = client
        .put(format!("{base}/defaults"))
        .json(&json!({"fourfive-chat": "local-chat", "agents": "local-chat"}))
        .send()
        .await
        .unwrap();
    assert_eq!(ok.status(), 200);
    let defaults: serde_json::Value =
        client.get(format!("{base}/defaults")).send().await.unwrap().json().await.unwrap();
    assert_eq!(defaults["fourfive-chat"], "local-chat");

    // Delete removes the file AND scrubs dangling default pointers.
    let del = client.delete(format!("{base}/local-chat")).send().await.unwrap();
    assert_eq!(del.status(), 204);
    assert!(!data_dir.join("profiles/local-chat.json").exists());
    let defaults: serde_json::Value =
        client.get(format!("{base}/defaults")).send().await.unwrap().json().await.unwrap();
    assert_eq!(defaults, json!({}));
    let missing = client.get(format!("{base}/local-chat")).send().await.unwrap();
    assert_eq!(missing.status(), 404);
}
