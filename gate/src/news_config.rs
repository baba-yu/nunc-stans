//! News pipeline settings API (Phase C, owner decision C5): the gate is
//! the one door, so the Formans settings drawer reads and writes
//! `<data store>/world/news-config.json` through it. The nunc-fluens
//! pipeline reads the same file at run start — this is how S-3's
//! "switch the search pair in settings" reaches the next run.

use std::path::PathBuf;

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};

use crate::GateCfg;

/// The settings shape the pipeline CLI consumes. Unknown fields are
/// rejected so a typo'd key can never silently no-op.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewsConfig {
    /// Executor: "claude-code" (default) or a provider name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime: Option<String>,
    /// "native" (provider search tool) or "external" (adapter).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    /// Adapter name when search = "external" (brave / searxng / tavily / perplexity).
    #[serde(rename = "searchEngine", skip_serializing_if = "Option::is_none")]
    pub search_engine: Option<String>,
    /// Synthesis model override for the runtime/provider.
    #[serde(rename = "synthModel", skip_serializing_if = "Option::is_none")]
    pub synth_model: Option<String>,
    /// Non-EN render locales (post-C P5): a subset of {ja, es, fil} —
    /// the DB schema is column-per-locale, so the universe is fixed.
    /// Absent = the full trio (behavior-preserving default); an empty
    /// array is a legitimate EN-only configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locales: Option<Vec<String>>,
}

impl NewsConfig {
    fn defaults() -> Self {
        Self {
            runtime: Some("claude-code".into()),
            search: Some("native".into()),
            search_engine: None,
            synth_model: None,
            locales: Some(vec!["ja".into(), "es".into(), "fil".into()]),
        }
    }

    fn validate(&self) -> Result<(), String> {
        if let Some(s) = &self.search {
            if s != "native" && s != "external" {
                return Err(format!("search must be 'native' or 'external', got {s:?}"));
            }
            if s == "external" && self.search_engine.as_deref().unwrap_or("").is_empty() {
                return Err("search='external' requires searchEngine".into());
            }
        }
        if let Some(r) = &self.runtime {
            if r.trim().is_empty() {
                return Err("runtime must not be empty".into());
            }
        }
        if let Some(ls) = &self.locales {
            let mut seen = std::collections::HashSet::new();
            for l in ls {
                if !matches!(l.as_str(), "ja" | "es" | "fil") {
                    return Err(format!(
                        "locales entries must be a subset of {{ja, es, fil}}, got {l:?} \
                         (arbitrary locales are a schema migration, not a setting)"
                    ));
                }
                if !seen.insert(l.as_str()) {
                    return Err(format!("locales contains duplicate entry {l:?}"));
                }
            }
        }
        Ok(())
    }
}

fn config_path(data_dir: &PathBuf) -> PathBuf {
    data_dir.join("world").join("news-config.json")
}

fn no_store() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        "no data store configured - start the gate with --data-dir (just up passes it)",
    )
        .into_response()
}

pub async fn get_news_config(State(cfg): State<GateCfg>) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    let path = config_path(data_dir);
    match tokio::fs::read(&path).await {
        Ok(bytes) => match serde_json::from_slice::<NewsConfig>(&bytes) {
            Ok(parsed) => Json(parsed).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("news-config.json is unreadable: {e}"),
            )
                .into_response(),
        },
        Err(_) => Json(NewsConfig::defaults()).into_response(),
    }
}

pub async fn put_news_config(
    State(cfg): State<GateCfg>,
    payload: Result<Json<NewsConfig>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    let Json(next) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    if let Err(msg) = next.validate() {
        return (StatusCode::UNPROCESSABLE_ENTITY, msg).into_response();
    }
    let path = config_path(data_dir);
    if let Some(parent) = path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("cannot create {}: {e}", parent.display()),
            )
                .into_response();
        }
    }
    // Atomic write: tmp + rename, same discipline as the pipeline's own
    // config writes.
    let tmp = path.with_extension("json.tmp");
    let body = match serde_json::to_vec_pretty(&next) {
        Ok(mut v) => {
            v.push(b'\n');
            v
        }
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("serialize: {e}")).into_response();
        }
    };
    if let Err(e) = tokio::fs::write(&tmp, &body).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("write {}: {e}", tmp.display()),
        )
            .into_response();
    }
    if let Err(e) = tokio::fs::rename(&tmp, &path).await {
        let _ = tokio::fs::remove_file(&tmp).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("rename into place: {e}"),
        )
            .into_response();
    }
    Json(next).into_response()
}
