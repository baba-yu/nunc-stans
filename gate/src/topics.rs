//! Topic authoring API (topics-authoring W6): the gate is the one door, so
//! the Formans World panel reads and writes the LINKED instance's
//! `data/reference/news-topics.json` through it — the single topic
//! authority the pipeline's coverage gate and compose fan-out both consume
//! (src/topics.ts). Same discipline as news_config.rs: deny-unknown fields,
//! validate, atomic tmp+rename.
//!
//! W7 read-only guard: edits target the linked instance, and PUT is refused
//! (409) unless that instance is a writable init-born one (has an
//! `instance.json` stamp). A news-shaped checkout or a bare view source is
//! never written (the fork rule — never write production ~/news).

use std::path::{Path, PathBuf};

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};

use crate::GateCfg;

/// One authored topic. Mirrors src/topics.ts `Topic`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Topic {
    pub name: String,
    /// The search-weight axis: deep | broad | watch.
    pub intent: String,
    /// Must be enumerated every run regardless of intent (orthogonal).
    pub mandatory: bool,
    /// The user's natural-language trace; renders as the gate's tag.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// The file shape. Mirrors src/topics.ts `TopicsFile`.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TopicsFile {
    pub topics: Vec<Topic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_sites: Option<Vec<String>>,
}

/// GET wraps the file with the writability the UI needs to show a
/// read-only banner (the file itself never carries it).
#[derive(Debug, Serialize)]
pub struct TopicsResponse {
    pub topics: Vec<Topic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_sites: Option<Vec<String>>,
    pub writable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read_only_reason: Option<String>,
}

impl TopicsFile {
    fn validate(&self) -> Result<(), String> {
        if self.topics.is_empty() {
            return Err("topics must be a non-empty array".into());
        }
        let mut seen = std::collections::HashSet::new();
        for (i, t) in self.topics.iter().enumerate() {
            if t.name.trim().is_empty() {
                return Err(format!("topics[{i}].name must not be empty"));
            }
            if !matches!(t.intent.as_str(), "deep" | "broad" | "watch") {
                return Err(format!(
                    "topics[{i}].intent must be one of deep|broad|watch, got {:?}",
                    t.intent
                ));
            }
            if !seen.insert(t.name.trim()) {
                return Err(format!("duplicate topic name {:?}", t.name.trim()));
            }
        }
        Ok(())
    }
}

fn topics_path(news_repo: &Path) -> PathBuf {
    news_repo
        .join("data")
        .join("reference")
        .join("news-topics.json")
}

/// W7: an init-born instance carries an `instance.json` stamp; a view
/// source / news-shaped checkout does not, and must never be written.
fn is_writable_instance(news_repo: &Path) -> bool {
    news_repo.join("instance.json").is_file()
}

fn no_instance() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        "no nunc-fluens instance linked - point the world view at one with \
         `just news-link <instance>` (create one with `just news-init`)",
    )
        .into_response()
}

pub async fn get_topics(State(cfg): State<GateCfg>) -> Response {
    let Some(news_repo) = &cfg.news_repo else {
        return no_instance();
    };
    if !news_repo.exists() {
        return (
            StatusCode::NOT_FOUND,
            format!(
                "linked instance {} does not exist - re-link with `just news-link`",
                news_repo.display()
            ),
        )
            .into_response();
    }
    let writable = is_writable_instance(news_repo);
    let read_only_reason = (!writable).then(|| {
        "the linked source is not an init-born instance (no instance.json) - \
         it is a read-only view source; author on a writable instance created \
         with `just news-init`"
            .to_string()
    });

    let path = topics_path(news_repo);
    let file = match tokio::fs::read(&path).await {
        Ok(bytes) => match serde_json::from_slice::<TopicsFile>(&bytes) {
            Ok(parsed) => parsed,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("news-topics.json is unreadable: {e}"),
                )
                    .into_response();
            }
        },
        // Absent = not yet migrated from .md, or a fresh authoring surface.
        // The UI authors from an empty list (the pipeline migrates .md on
        // its own next run; we never convert in Rust).
        Err(_) => TopicsFile::default(),
    };

    Json(TopicsResponse {
        topics: file.topics,
        reference_sites: file.reference_sites,
        writable,
        read_only_reason,
    })
    .into_response()
}

pub async fn put_topics(
    State(cfg): State<GateCfg>,
    payload: Result<Json<TopicsFile>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Some(news_repo) = &cfg.news_repo else {
        return no_instance();
    };
    if !is_writable_instance(news_repo) {
        return (
            StatusCode::CONFLICT,
            "the linked source is read-only (not an init-born instance) - topics \
             can only be authored on a writable instance created with `just news-init`",
        )
            .into_response();
    }
    let Json(next) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    if let Err(msg) = next.validate() {
        return (StatusCode::UNPROCESSABLE_ENTITY, msg).into_response();
    }

    let path = topics_path(news_repo);
    if let Some(parent) = path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("cannot create {}: {e}", parent.display()),
            )
                .into_response();
        }
    }
    // Atomic write: tmp + rename (the news_config.rs / pipeline discipline).
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

// --- NL structuring (W4): thin proxy to the local model -------------------
// The browser sends a plain-language request; the gate asks the local
// `llama-server` (OpenAI-compatible) to structure it into the topic model,
// constrained by a json_schema, and returns the model's JSON. The browser
// merges the proposal into the existing set and shows the diff before
// saving (W5/F6 — nothing is written unattended). The gate holds NO topic
// logic beyond the shape it already knows; prompt wording stays minimal.
// Model down ⇒ 503, and the UI degrades to "run just setup".

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExtractRequest {
    /// The user's natural-language request.
    request: String,
    /// Existing topic names, so the model refines rather than duplicates.
    #[serde(default)]
    existing: Vec<String>,
}

pub async fn extract_topics(
    State(cfg): State<GateCfg>,
    payload: Result<Json<ExtractRequest>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(req) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    if req.request.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "request must not be empty").into_response();
    }

    // The topic model as a json_schema, so the model's output is constrained.
    let schema = serde_json::json!({
        "type": "object",
        "properties": {
            "topics": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "intent": {"type": "string", "enum": ["deep", "broad", "watch"]},
                        "mandatory": {"type": "boolean"},
                        "note": {"type": "string"}
                    },
                    "required": ["name", "intent", "mandatory"]
                }
            }
        },
        "required": ["topics"]
    });
    let system = format!(
        "You structure a user's request into research topics for a news pipeline. \
         Output ONLY JSON matching the schema: an array of {{name, intent, mandatory, note}}. \
         intent: deep = a topic to investigate thoroughly, broad = a light multi-angle scan, \
         watch = a light single check. mandatory = must be covered every run. \
         Reuse these existing topic names verbatim when the request refines them: [{}].",
        req.existing.join(", ")
    );
    let body = serde_json::json!({
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": req.request}
        ],
        "response_format": {"type": "json_schema", "json_schema": {"name": "topics", "schema": schema, "strict": true}},
        "stream": false,
        "temperature": 0.2
    });

    let url = format!("{}/v1/chat/completions", cfg.llama_url.trim_end_matches('/'));
    let res = match cfg
        .client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
    {
        Ok(r) => r,
        // Connection refused / DNS / timeout = the model is not running.
        Err(_) => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                "local model offline - run `just setup` to enable AI structuring \
                 (manual topic editing works without it)",
            )
                .into_response();
        }
    };
    if !res.status().is_success() {
        let code = res.status();
        let detail = res.text().await.unwrap_or_default();
        return (
            StatusCode::BAD_GATEWAY,
            format!("local model error ({code}): {}", detail.chars().take(300).collect::<String>()),
        )
            .into_response();
    }
    let completion: serde_json::Value = match res.json().await {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_GATEWAY, format!("model reply unreadable: {e}")).into_response(),
    };
    // OpenAI shape: choices[0].message.content is the JSON string.
    let content = completion["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    match serde_json::from_str::<serde_json::Value>(content) {
        Ok(parsed) => Json(parsed).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            format!("model did not return valid topic JSON: {e}"),
        )
            .into_response(),
    }
}
