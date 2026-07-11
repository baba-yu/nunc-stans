//! Commitment NL structuring: the ME AuthorForm's natural-language leg.
//! Same shape as topics.rs W4 — a thin proxy that asks the local
//! `llama-server` (OpenAI-compatible) to structure a plain sentence into
//! the commitment fields, constrained by a json_schema. The gate returns
//! the model's JSON verbatim; the browser PREFILLS the form with it and
//! the user reviews, edits, and presses Author — the LLM only proposes,
//! decision authority stays with the user (constitution F3/F6: writing a
//! commitment is user-only). Model down ⇒ 503, and the form's manual
//! path is unaffected.

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Deserialize;

use crate::GateCfg;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExtractRequest {
    /// The user's natural-language description of the commitment.
    request: String,
    /// The user's local date (YYYY-MM-DD) so relative dates ("since June",
    /// "last week") resolve in the user's timezone, not the server's.
    #[serde(default)]
    today: Option<String>,
}

pub async fn extract_commitment(
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

    // The commitment fields as a json_schema — mirrors the engine's
    // NewCommitment (slug/title/started_at required; resources optional).
    let schema = serde_json::json!({
        "type": "object",
        "properties": {
            "slug": {"type": "string", "pattern": "^[a-z0-9-]+$"},
            "title": {"type": "string"},
            "started_at": {"type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
            "money_jpy": {"type": ["integer", "null"]},
            "hours": {"type": ["number", "null"]},
            "note": {"type": ["string", "null"]}
        },
        "required": ["slug", "title", "started_at"]
    });
    let today = req
        .today
        .as_deref()
        .filter(|d| !d.trim().is_empty())
        .unwrap_or("unknown");
    let system = format!(
        "You structure a user's description of a personal commitment (a bet of \
         their own money/time) into fields. Output ONLY JSON matching the schema. \
         slug: a short kebab-case identifier (a-z, 0-9, -) derived from the title. \
         title: the commitment in the user's own words and language. \
         started_at: YYYY-MM-DD; resolve relative dates against today = {today}; \
         if no start date is given, use today. \
         money_jpy: the committed money as a whole number of yen, null if not stated. \
         hours: the committed hours as a number, null if not stated. \
         note: any remaining nuance from the request in the user's language, null if none. \
         Never invent amounts or dates that were not stated or clearly implied."
    );
    let body = serde_json::json!({
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": req.request}
        ],
        "response_format": {"type": "json_schema", "json_schema": {"name": "commitment", "schema": schema, "strict": true}},
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
                 (manual authoring works without it)",
            )
                .into_response();
        }
    };
    if !res.status().is_success() {
        let code = res.status();
        let detail = res.text().await.unwrap_or_default();
        return (
            StatusCode::BAD_GATEWAY,
            format!(
                "local model error ({code}): {}",
                detail.chars().take(300).collect::<String>()
            ),
        )
            .into_response();
    }
    let completion: serde_json::Value = match res.json().await {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, format!("model reply unreadable: {e}"))
                .into_response();
        }
    };
    // OpenAI shape: choices[0].message.content is the JSON string.
    let content = completion["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    match serde_json::from_str::<serde_json::Value>(content) {
        Ok(parsed) => Json(parsed).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            format!("model did not return valid commitment JSON: {e}"),
        )
            .into_response(),
    }
}
