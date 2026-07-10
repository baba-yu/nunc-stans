//! Model-backend settings API: the Formans settings panel reads and writes
//! the APP config (`<config-home>/nunc-stans/config.json`) keys the local
//! model runtime consumes — `llama_model`, `llama_ctx`, `llama_parallel`
//! (serving knobs resolved by tools/llama.ts for `just up` / `just llama`)
//! and `llama_url` (external OpenAI-compatible backend; empty string is the
//! explicit "use the local server" choice). Values apply when the model
//! backend RESTARTS — the gate cannot bounce the llama leg, and says so.
//!
//! The config file carries unrelated keys (data_dir, news_repo, …) that a
//! settings write must never clobber: writes are read-modify-write on the
//! parsed object with an atomic tmp+rename, same discipline as the profile
//! store.

use std::path::PathBuf;

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::GateCfg;

/// Mirror tools/llama.ts defaults (CTX_DEFAULT / PARALLEL_DEFAULT).
const CTX_DEFAULT: u64 = 32768;
const PARALLEL_DEFAULT: u64 = 4;

/// The editable keys. Absent field on PUT = remove the key (back to the
/// default); deny-unknown so a typo'd knob can never silently no-op.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ModelBackend {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llama_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llama_ctx: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llama_parallel: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llama_url: Option<String>,
}

impl ModelBackend {
    fn validate(&self, available_models: &[String]) -> Result<(), String> {
        if let Some(m) = &self.llama_model {
            if m.trim().is_empty() || m.contains('/') || m.contains('\\') || m.contains("..") {
                return Err(format!("llama_model must be a plain GGUF file name, got {m:?}"));
            }
            if !available_models.is_empty() && !available_models.iter().any(|a| a == m) {
                return Err(format!(
                    "llama_model {m:?} is not in <store>/models (available: {})",
                    available_models.join(", ")
                ));
            }
        }
        if let Some(c) = self.llama_ctx {
            if !(1024..=262_144).contains(&c) {
                return Err(format!("llama_ctx must be 1024..=262144, got {c}"));
            }
        }
        if let Some(p) = self.llama_parallel {
            if !(1..=32).contains(&p) {
                return Err(format!("llama_parallel must be 1..=32, got {p}"));
            }
        }
        if let Some(u) = &self.llama_url {
            if !u.is_empty() && !(u.starts_with("http://") || u.starts_with("https://")) {
                return Err(format!(
                    "llama_url must be empty (local server) or an http(s) URL, got {u:?}"
                ));
            }
        }
        if let (Some(c), Some(p)) = (self.llama_ctx, self.llama_parallel) {
            if c / p < 1024 {
                return Err(format!(
                    "ctx {c} across {p} parallel slots leaves under 1024 tokens per slot — raise llama_ctx or lower llama_parallel"
                ));
            }
        }
        Ok(())
    }
}

/// Apply the PUT body onto the parsed config object: Some ⇒ set,
/// None ⇒ remove (reset to default). Every other key survives untouched.
fn apply(cfg: &mut Map<String, Value>, body: &ModelBackend) {
    fn set_or_remove(cfg: &mut Map<String, Value>, key: &str, v: Option<Value>) {
        match v {
            Some(v) => {
                cfg.insert(key.to_owned(), v);
            }
            None => {
                cfg.remove(key);
            }
        }
    }
    set_or_remove(cfg, "llama_model", body.llama_model.clone().map(Value::from));
    set_or_remove(cfg, "llama_ctx", body.llama_ctx.map(Value::from));
    set_or_remove(cfg, "llama_parallel", body.llama_parallel.map(Value::from));
    set_or_remove(cfg, "llama_url", body.llama_url.clone().map(Value::from));
}

fn config_file(cfg: &GateCfg) -> PathBuf {
    if let Some(f) = &cfg.app_config_file {
        return f.clone();
    }
    if cfg!(windows) {
        PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join("nunc-stans")
            .join("config.json")
    } else {
        std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".config")
            })
            .join("nunc-stans")
            .join("config.json")
    }
}

async fn read_obj(path: &PathBuf) -> Map<String, Value> {
    match tokio::fs::read(path).await {
        Ok(bytes) => serde_json::from_slice::<Value>(&bytes)
            .ok()
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default(),
        Err(_) => Map::new(),
    }
}

fn available_models(cfg: &GateCfg) -> Vec<String> {
    let Some(data_dir) = &cfg.data_dir else {
        return Vec::new();
    };
    let mut out: Vec<String> = std::fs::read_dir(data_dir.join("models"))
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| e.file_name().into_string().ok())
                .filter(|n| n.to_ascii_lowercase().ends_with(".gguf"))
                .collect()
        })
        .unwrap_or_default();
    out.sort();
    out
}

/// The number a knob resolves to at serve time (config value, else default) —
/// tolerant of string-typed values (tools/config-set.ts writes strings).
fn knob(cfg: &Map<String, Value>, key: &str, dflt: u64) -> u64 {
    match cfg.get(key) {
        Some(Value::Number(n)) => n.as_u64().unwrap_or(dflt),
        Some(Value::String(s)) => s.parse().unwrap_or(dflt),
        _ => dflt,
    }
}

fn str_key(cfg: &Map<String, Value>, key: &str) -> Option<String> {
    cfg.get(key).and_then(|v| v.as_str()).map(str::to_owned)
}

pub async fn get_model_backend(State(cfg): State<GateCfg>) -> Response {
    let file = config_file(&cfg);
    let obj = read_obj(&file).await;
    let url = str_key(&obj, "llama_url").unwrap_or_default();
    let available = available_models(&cfg);
    let catalog: Vec<Value> = read_catalog(&cfg)
        .into_iter()
        .map(|c| {
            let installed = available.iter().any(|a| a == &c.file);
            json!({
                "id": c.id, "label": c.label, "file": c.file, "approx": c.approx,
                "note": c.note, "installed": installed,
            })
        })
        .collect();
    Json(json!({
        "catalog": catalog,
        "llama_model": str_key(&obj, "llama_model"),
        "llama_ctx": knob(&obj, "llama_ctx", CTX_DEFAULT),
        "llama_parallel": knob(&obj, "llama_parallel", PARALLEL_DEFAULT),
        "llama_url": url,
        "defaults": { "llama_ctx": CTX_DEFAULT, "llama_parallel": PARALLEL_DEFAULT },
        "available_models": available,
        "effective_backend": if url.is_empty() { "local" } else { "external" },
        "applies_on": "model-backend restart (just up / just llama)",
    }))
    .into_response()
}

pub async fn put_model_backend(
    State(cfg): State<GateCfg>,
    payload: Result<Json<ModelBackend>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    if let Err(msg) = body.validate(&available_models(&cfg)) {
        return (StatusCode::UNPROCESSABLE_ENTITY, msg).into_response();
    }
    let file = config_file(&cfg);
    let mut obj = read_obj(&file).await;
    apply(&mut obj, &body);
    if let Some(parent) = file.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("cannot create {}: {e}", parent.display()),
            )
                .into_response();
        }
    }
    let tmp = file.with_extension("json.tmp");
    let mut bytes = match serde_json::to_vec_pretty(&Value::Object(obj)) {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("serialize: {e}")).into_response();
        }
    };
    bytes.push(b'\n');
    if let Err(e) = tokio::fs::write(&tmp, &bytes).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("write {}: {e}", tmp.display()),
        )
            .into_response();
    }
    if let Err(e) = tokio::fs::rename(&tmp, &file).await {
        let _ = tokio::fs::remove_file(&tmp).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("rename into place: {e}"),
        )
            .into_response();
    }
    get_model_backend(State(cfg)).await
}

// --- model install (download) + backend restart ------------------------

/// One in-flight GGUF download; the Formans panel polls its progress.
#[derive(Debug)]
pub struct DownloadJob {
    pub file: String,
    pub total: Option<u64>,
    pub done: std::sync::Arc<std::sync::atomic::AtomicU64>,
    pub state: std::sync::Arc<std::sync::Mutex<String>>, // running | done | error: <msg>
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DownloadRequest {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CatalogEntry {
    pub id: String,
    pub label: String,
    pub file: String,
    pub url: String,
    #[serde(default)]
    pub approx: String,
    #[serde(default)]
    pub note: String,
}

pub fn read_catalog(cfg: &GateCfg) -> Vec<CatalogEntry> {
    let Some(path) = &cfg.model_catalog else {
        return Vec::new();
    };
    std::fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .and_then(|v| v.get("models").cloned())
        .and_then(|m| serde_json::from_value::<Vec<CatalogEntry>>(m).ok())
        .unwrap_or_default()
}

/// A download target must be an https .gguf and land as a PLAIN file name.
fn vet_download(url: &str) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err(format!("model URL must be https, got {url:?}"));
    }
    let name = url
        .split('?')
        .next()
        .unwrap_or("")
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_owned();
    if !name.to_ascii_lowercase().ends_with(".gguf") || name.contains("..") || name.len() < 6 {
        return Err(format!("URL must name a .gguf file, got {name:?}"));
    }
    Ok(name)
}

pub async fn get_download(State(cfg): State<GateCfg>) -> Response {
    let guard = cfg.download.lock().unwrap();
    match guard.as_ref() {
        None => Json(json!({ "state": "idle" })).into_response(),
        Some(job) => {
            let done = job.done.load(std::sync::atomic::Ordering::Relaxed);
            Json(json!({
                "state": job.state.lock().unwrap().clone(),
                "file": job.file,
                "done_bytes": done,
                "total_bytes": job.total,
                "percent": job.total.map(|t| if t > 0 { (done as f64 / t as f64 * 100.0).round() } else { 0.0 }),
            }))
            .into_response()
        }
    }
}

pub async fn post_download(
    State(cfg): State<GateCfg>,
    payload: Result<Json<DownloadRequest>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Some(data_dir) = cfg.data_dir.clone() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "no data store configured").into_response();
    };
    let Json(req) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    let url = match (&req.id, &req.url) {
        (Some(id), _) => match read_catalog(&cfg).into_iter().find(|c| &c.id == id) {
            Some(c) => c.url,
            None => {
                return (StatusCode::UNPROCESSABLE_ENTITY, format!("no catalog entry {id:?}"))
                    .into_response();
            }
        },
        (None, Some(u)) => u.clone(),
        (None, None) => {
            return (StatusCode::BAD_REQUEST, "need id (catalog) or url").into_response();
        }
    };
    let name = match vet_download(&url) {
        Ok(n) => n,
        Err(msg) => return (StatusCode::UNPROCESSABLE_ENTITY, msg).into_response(),
    };
    let models_dir = data_dir.join("models");
    let dest = models_dir.join(&name);
    if dest.exists() {
        return (StatusCode::CONFLICT, format!("{name} is already installed")).into_response();
    }
    {
        let mut guard = cfg.download.lock().unwrap();
        if let Some(job) = guard.as_ref() {
            if job.state.lock().unwrap().as_str() == "running" {
                return (
                    StatusCode::CONFLICT,
                    format!("a download is already running ({})", job.file),
                )
                    .into_response();
            }
        }
        let job = DownloadJob {
            file: name.clone(),
            total: None,
            done: std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0)),
            state: std::sync::Arc::new(std::sync::Mutex::new("running".to_owned())),
        };
        let done = job.done.clone();
        let state = job.state.clone();
        let client = cfg.client.clone();
        let slot = cfg.download.clone();
        let file_name = name.clone();
        tokio::spawn(async move {
            let fail = |msg: String, state: &std::sync::Arc<std::sync::Mutex<String>>| {
                *state.lock().unwrap() = format!("error: {msg}");
            };
            if let Err(e) = tokio::fs::create_dir_all(&models_dir).await {
                return fail(format!("mkdir: {e}"), &state);
            }
            let part = models_dir.join(format!("{file_name}.part"));
            let res = match client.get(&url).send().await {
                Ok(r) if r.status().is_success() => r,
                Ok(r) => return fail(format!("HTTP {}", r.status()), &state),
                Err(e) => return fail(format!("{e}"), &state),
            };
            let total = res.content_length();
            if let Some(t) = total {
                if let Some(j) = slot.lock().unwrap().as_mut() {
                    j.total = Some(t);
                }
            }
            let mut out = match tokio::fs::File::create(&part).await {
                Ok(f) => f,
                Err(e) => return fail(format!("create {}: {e}", part.display()), &state),
            };
            let mut res = res;
            use tokio::io::AsyncWriteExt;
            loop {
                match res.chunk().await {
                    Ok(Some(bytes)) => {
                        if let Err(e) = out.write_all(&bytes).await {
                            let _ = tokio::fs::remove_file(&part).await;
                            return fail(format!("write: {e}"), &state);
                        }
                        done.fetch_add(bytes.len() as u64, std::sync::atomic::Ordering::Relaxed);
                    }
                    Ok(None) => break,
                    Err(e) => {
                        let _ = tokio::fs::remove_file(&part).await;
                        return fail(format!("read: {e}"), &state);
                    }
                }
            }
            if let Err(e) = out.sync_all().await {
                return fail(format!("sync: {e}"), &state);
            }
            drop(out);
            if let Err(e) = tokio::fs::rename(&part, &dest).await {
                let _ = tokio::fs::remove_file(&part).await;
                return fail(format!("rename: {e}"), &state);
            }
            *state.lock().unwrap() = "done".to_owned();
        });
        *guard = Some(job);
    }
    (StatusCode::ACCEPTED, format!("downloading {name}")).into_response()
}

/// SIGTERM the llama-server on :8080 so the `_up-llama` restart loop brings
/// it back with the CURRENT settings. Name-checked — an unrelated :8080
/// squatter is refused. Linux/WSL only (the stack's runtime).
pub async fn post_restart(State(_cfg): State<GateCfg>) -> Response {
    if !cfg!(target_os = "linux") {
        return (
            StatusCode::NOT_IMPLEMENTED,
            "backend restart is Linux/WSL-only - run `just llama` by hand",
        )
            .into_response();
    }
    let out = std::process::Command::new("ss")
        .args(["-ltnpH", "sport = :8080"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default();
    let mut killed = Vec::new();
    for cap in out.split("pid=").skip(1) {
        let pid: String = cap.chars().take_while(|c| c.is_ascii_digit()).collect();
        if pid.is_empty() {
            continue;
        }
        let comm = std::fs::read_to_string(format!("/proc/{pid}/comm")).unwrap_or_default();
        if comm.trim().starts_with("llama-server") {
            let _ = std::process::Command::new("kill").args(["-TERM", &pid]).status();
            killed.push(pid);
        }
    }
    if killed.is_empty() {
        return (
            StatusCode::NOT_FOUND,
            "no llama-server on :8080 (external backend, or the leg is inert - restart via just up)",
        )
            .into_response();
    }
    Json(json!({ "restarted": killed, "note": "the _up-llama loop restarts it with the saved settings" }))
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(model: Option<&str>, ctx: Option<u64>, par: Option<u64>, url: Option<&str>) -> ModelBackend {
        ModelBackend {
            llama_model: model.map(str::to_owned),
            llama_ctx: ctx,
            llama_parallel: par,
            llama_url: url.map(str::to_owned),
        }
    }

    #[test]
    fn knob_ranges() {
        assert!(body(None, Some(512), None, None).validate(&[]).is_err());
        assert!(body(None, Some(1024), None, None).validate(&[]).is_ok());
        assert!(body(None, None, Some(0), None).validate(&[]).is_err());
        assert!(body(None, None, Some(33), None).validate(&[]).is_err());
        assert!(body(None, None, Some(4), None).validate(&[]).is_ok());
    }

    #[test]
    fn per_slot_floor() {
        // 4096 across 8 slots = 512/slot — refused.
        assert!(body(None, Some(4096), Some(8), None).validate(&[]).is_err());
        assert!(body(None, Some(32768), Some(4), None).validate(&[]).is_ok());
    }

    #[test]
    fn url_shapes() {
        assert!(body(None, None, None, Some("")).validate(&[]).is_ok());
        assert!(body(None, None, None, Some("http://127.0.0.1:11434")).validate(&[]).is_ok());
        assert!(body(None, None, None, Some("ftp://x")).validate(&[]).is_err());
        assert!(body(None, None, None, Some("11434")).validate(&[]).is_err());
    }

    #[test]
    fn model_name_is_a_plain_file_name() {
        for bad in ["", "../escape.gguf", "a/b.gguf", "a\\b.gguf"] {
            assert!(body(Some(bad), None, None, None).validate(&[]).is_err(), "{bad}");
        }
        // Unknown name is refused when the store lists models…
        assert!(
            body(Some("nope.gguf"), None, None, None)
                .validate(&["real.gguf".into()])
                .is_err()
        );
        // …and accepted verbatim when the store is unknown (no data_dir).
        assert!(body(Some("any.gguf"), None, None, None).validate(&[]).is_ok());
        assert!(
            body(Some("real.gguf"), None, None, None)
                .validate(&["real.gguf".into()])
                .is_ok()
        );
    }

    #[test]
    fn apply_preserves_foreign_keys_and_removes_absent() {
        let mut cfg: Map<String, Value> = serde_json::from_str(
            r#"{"data_dir":"/keep","news_repo":"/keep2","llama_ctx":8192,"llama_url":"http://x"}"#,
        )
        .unwrap();
        // ctx set, parallel set, model absent (no-op removal), url absent (removed)
        apply(&mut cfg, &body(None, Some(32768), Some(4), None));
        assert_eq!(cfg.get("data_dir").unwrap(), "/keep");
        assert_eq!(cfg.get("news_repo").unwrap(), "/keep2");
        assert_eq!(cfg.get("llama_ctx").unwrap(), 32768);
        assert_eq!(cfg.get("llama_parallel").unwrap(), 4);
        assert!(!cfg.contains_key("llama_url"));
    }

    #[test]
    fn download_targets_are_vetted() {
        assert!(vet_download("http://x/a.gguf").is_err()); // https only
        assert!(vet_download("https://x/dir/").is_err());
        assert!(vet_download("https://x/..gguf").is_err());
        assert_eq!(
            vet_download("https://hf.co/r/resolve/main/model-Q4.gguf?download=true").unwrap(),
            "model-Q4.gguf"
        );
    }

    #[test]
    fn knob_reads_string_typed_values() {
        let cfg: Map<String, Value> =
            serde_json::from_str(r#"{"llama_ctx":"16384"}"#).unwrap();
        assert_eq!(knob(&cfg, "llama_ctx", 32768), 16384);
        assert_eq!(knob(&cfg, "llama_parallel", 4), 4);
    }
}
