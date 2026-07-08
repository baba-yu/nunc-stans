//! Agent-profile store API (Phase D, plan PD2/PD3): profiles are plain
//! JSON files at `<data store>/profiles/<id>.json`, served through the one
//! door with the news-config discipline — deny-unknown-fields, validate,
//! atomic tmp+rename. The default-per-context pointer lives beside them in
//! `profiles/defaults.json`.
//!
//! Two rails are code here, not prose:
//! - F3: no profile may grant write access to self-scope commitments —
//!   such a profile cannot even be saved (v1 plan §2.7).
//! - BYOL (PD2): profiles name providers/models, never credentials — any
//!   credential-shaped key inside the freeform `ui` object is rejected.

use std::path::{Path, PathBuf};

use axum::{
    Json,
    extract::{Path as UrlPath, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};

use crate::GateCfg;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MemoryScope {
    #[serde(default)]
    pub read: Vec<String>,
    #[serde(default)]
    pub write: Vec<String>,
}

/// Mirrors nunc-ai's VerifyConfig (camelCase on the wire).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GoalVerify {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verify: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub goal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub judge: Option<Judge>,
    #[serde(rename = "maxIters", skip_serializing_if = "Option::is_none")]
    pub max_iters: Option<u32>,
    #[serde(rename = "tokenBudget", skip_serializing_if = "Option::is_none")]
    pub token_budget: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Judge {
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

/// The v1 plan §2.7 profile record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// Provider or agent runtime name (nunc-ai registry).
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(rename = "system_prompt", skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    /// Tool allowlist (skills the agent may use).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<String>>,
    #[serde(rename = "memory_scope", skip_serializing_if = "Option::is_none")]
    pub memory_scope: Option<MemoryScope>,
    #[serde(rename = "goal_verify", skip_serializing_if = "Option::is_none")]
    pub goal_verify: Option<GoalVerify>,
    /// Freeform UI prefs — the one open object, so the no-credentials
    /// rule is enforced on its keys recursively.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui: Option<serde_json::Value>,
}

/// Default profile per calling context (PD3). Keys are fixed; a pointer
/// may be absent.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Defaults {
    #[serde(rename = "fourfive-chat", skip_serializing_if = "Option::is_none")]
    pub fourfive_chat: Option<String>,
    #[serde(rename = "news-steps", skip_serializing_if = "Option::is_none")]
    pub news_steps: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agents: Option<String>,
}

fn credential_shaped(key: &str) -> bool {
    let k = key.to_ascii_lowercase();
    ["key", "token", "secret", "password", "credential"]
        .iter()
        .any(|w| k.contains(w))
}

fn scan_ui_keys(value: &serde_json::Value) -> Result<(), String> {
    match value {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                if credential_shaped(k) {
                    return Err(format!(
                        "ui contains a credential-shaped key {k:?} — profiles never hold \
                         secrets (BYOL: keys stay in the environment)"
                    ));
                }
                scan_ui_keys(v)?;
            }
            Ok(())
        }
        serde_json::Value::Array(items) => {
            for v in items {
                scan_ui_keys(v)?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

impl Profile {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty()
            || !self
                .id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(format!(
                "id must be a non-empty lowercase slug ([a-z0-9-]), got {:?}",
                self.id
            ));
        }
        if self.name.trim().is_empty() {
            return Err("name must not be empty".into());
        }
        if self.provider.trim().is_empty() {
            return Err("provider must not be empty".into());
        }
        if let Some(scope) = &self.memory_scope {
            for entry in scope.read.iter().chain(scope.write.iter()) {
                if entry.trim().is_empty() || entry.contains(char::is_whitespace) {
                    return Err(format!("memory_scope entries must be scope ids, got {entry:?}"));
                }
            }
            // F3 (constitution): commitments are user-only. A profile
            // granting write access to them cannot be saved.
            for entry in &scope.write {
                let normalized = entry.strip_suffix("/*").unwrap_or(entry);
                if normalized == "self/commitment"
                    || entry.starts_with("self/commitment/")
                    || entry == "self/*"
                    || entry == "self"
                {
                    return Err(format!(
                        "F3: no profile may grant write access to self-scope commitments \
                         (memory_scope.write contains {entry:?}); commitments are user-only"
                    ));
                }
            }
        }
        if let Some(gv) = &self.goal_verify {
            if let Some(v) = &gv.verify {
                if v != "on" && v != "off" {
                    return Err(format!("goal_verify.verify must be 'on' or 'off', got {v:?}"));
                }
            }
            if gv.max_iters == Some(0) {
                return Err("goal_verify.maxIters must be at least 1".into());
            }
        }
        if let Some(ui) = &self.ui {
            if !ui.is_object() {
                return Err("ui must be an object".into());
            }
            scan_ui_keys(ui)?;
        }
        Ok(())
    }
}

fn profiles_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("profiles")
}

fn profile_path(data_dir: &Path, id: &str) -> PathBuf {
    profiles_dir(data_dir).join(format!("{id}.json"))
}

fn defaults_path(data_dir: &Path) -> PathBuf {
    profiles_dir(data_dir).join("defaults.json")
}

fn no_store() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        "no data store configured - start the gate with --data-dir (just up passes it)",
    )
        .into_response()
}

/// Slug ids double as file names — reject anything else before it can
/// touch the filesystem.
fn checked_id(id: &str) -> Result<(), Response> {
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        || id == "defaults"
    {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("profile id must be a lowercase slug ([a-z0-9-], not 'defaults'), got {id:?}"),
        )
            .into_response());
    }
    Ok(())
}

async fn write_atomic(path: &Path, value: &impl Serialize) -> Result<(), Response> {
    if let Some(parent) = path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("cannot create {}: {e}", parent.display()),
            )
                .into_response());
        }
    }
    let tmp = path.with_extension("json.tmp");
    let mut body = match serde_json::to_vec_pretty(value) {
        Ok(v) => v,
        Err(e) => {
            return Err(
                (StatusCode::INTERNAL_SERVER_ERROR, format!("serialize: {e}")).into_response()
            );
        }
    };
    body.push(b'\n');
    if let Err(e) = tokio::fs::write(&tmp, &body).await {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("write {}: {e}", tmp.display()),
        )
            .into_response());
    }
    if let Err(e) = tokio::fs::rename(&tmp, path).await {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("rename into place: {e}"),
        )
            .into_response());
    }
    Ok(())
}

async fn read_defaults(data_dir: &Path) -> Defaults {
    match tokio::fs::read(defaults_path(data_dir)).await {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => Defaults::default(),
    }
}

pub async fn list_profiles(State(cfg): State<GateCfg>) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    let dir = profiles_dir(data_dir);
    let mut out: Vec<Profile> = Vec::new();
    let mut entries = match tokio::fs::read_dir(&dir).await {
        Ok(e) => e,
        Err(_) => return Json(out).into_response(), // no dir yet = empty list
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        let is_profile = path.extension().is_some_and(|e| e == "json")
            && path.file_stem().is_some_and(|s| s != "defaults");
        if !is_profile {
            continue;
        }
        if let Ok(bytes) = tokio::fs::read(&path).await {
            if let Ok(p) = serde_json::from_slice::<Profile>(&bytes) {
                out.push(p);
            }
            // malformed files are skipped, not fatal — same posture as
            // manda's malformed-line rule
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Json(out).into_response()
}

pub async fn get_profile(State(cfg): State<GateCfg>, UrlPath(id): UrlPath<String>) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    if let Err(r) = checked_id(&id) {
        return r;
    }
    match tokio::fs::read(profile_path(data_dir, &id)).await {
        Ok(bytes) => match serde_json::from_slice::<Profile>(&bytes) {
            Ok(p) => Json(p).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("profile {id} is unreadable: {e}"),
            )
                .into_response(),
        },
        Err(_) => (StatusCode::NOT_FOUND, format!("no profile {id:?}")).into_response(),
    }
}

pub async fn put_profile(
    State(cfg): State<GateCfg>,
    UrlPath(id): UrlPath<String>,
    payload: Result<Json<Profile>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    if let Err(r) = checked_id(&id) {
        return r;
    }
    let Json(profile) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    if profile.id != id {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("body id {:?} must match the url id {id:?}", profile.id),
        )
            .into_response();
    }
    if let Err(msg) = profile.validate() {
        return (StatusCode::UNPROCESSABLE_ENTITY, msg).into_response();
    }
    if let Err(r) = write_atomic(&profile_path(data_dir, &id), &profile).await {
        return r;
    }
    Json(profile).into_response()
}

pub async fn delete_profile(State(cfg): State<GateCfg>, UrlPath(id): UrlPath<String>) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    if let Err(r) = checked_id(&id) {
        return r;
    }
    match tokio::fs::remove_file(profile_path(data_dir, &id)).await {
        Ok(()) => {}
        Err(_) => return (StatusCode::NOT_FOUND, format!("no profile {id:?}")).into_response(),
    }
    // Drop dangling default pointers so a context never names a ghost.
    let mut defaults = read_defaults(data_dir).await;
    let mut changed = false;
    for slot in [
        &mut defaults.fourfive_chat,
        &mut defaults.news_steps,
        &mut defaults.agents,
    ] {
        if slot.as_deref() == Some(id.as_str()) {
            *slot = None;
            changed = true;
        }
    }
    if changed {
        if let Err(r) = write_atomic(&defaults_path(data_dir), &defaults).await {
            return r;
        }
    }
    StatusCode::NO_CONTENT.into_response()
}

pub async fn get_defaults(State(cfg): State<GateCfg>) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    Json(read_defaults(data_dir).await).into_response()
}

pub async fn put_defaults(
    State(cfg): State<GateCfg>,
    payload: Result<Json<Defaults>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Some(data_dir) = &cfg.data_dir else {
        return no_store();
    };
    let Json(defaults) = match payload {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("invalid body: {e}")).into_response(),
    };
    // Every named pointer must reference an existing profile.
    for (context, slot) in [
        ("fourfive-chat", &defaults.fourfive_chat),
        ("news-steps", &defaults.news_steps),
        ("agents", &defaults.agents),
    ] {
        if let Some(id) = slot {
            if checked_id(id).is_err() {
                return (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    format!("{context}: {id:?} is not a valid profile id"),
                )
                    .into_response();
            }
            if !profile_path(data_dir, id).exists() {
                return (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    format!("{context}: no profile {id:?} exists"),
                )
                    .into_response();
            }
        }
    }
    if let Err(r) = write_atomic(&defaults_path(data_dir), &defaults).await {
        return r;
    }
    Json(defaults).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal(id: &str) -> Profile {
        Profile {
            id: id.into(),
            name: "A profile".into(),
            provider: "ollama".into(),
            model: None,
            system_prompt: None,
            skills: None,
            memory_scope: None,
            goal_verify: None,
            ui: None,
        }
    }

    #[test]
    fn f3_rejects_commitment_write_scope() {
        for scope in ["self/commitment/x", "self/commitment", "self/commitment/*", "self/*", "self"] {
            let mut p = minimal("p");
            p.memory_scope = Some(MemoryScope { read: vec![], write: vec![scope.into()] });
            let err = p.validate().unwrap_err();
            assert!(err.contains("F3"), "{scope}: {err}");
        }
    }

    #[test]
    fn commitment_read_scope_is_fine() {
        let mut p = minimal("p");
        p.memory_scope = Some(MemoryScope {
            read: vec!["self/commitment/*".into()],
            write: vec!["notes/*".into()],
        });
        assert!(p.validate().is_ok());
    }

    #[test]
    fn credential_shaped_ui_keys_are_rejected() {
        for key in ["apiKey", "TOKEN", "client_secret", "password", "x-credential"] {
            let mut p = minimal("p");
            p.ui = Some(serde_json::json!({ "nested": { key: "v" } }));
            let err = p.validate().unwrap_err();
            assert!(err.contains("credential-shaped"), "{key}: {err}");
        }
    }

    #[test]
    fn slug_ids_only() {
        assert!(minimal("ok-slug-9").validate().is_ok());
        for bad in ["", "Upper", "with space", "dot.json", "../escape"] {
            assert!(minimal(bad).validate().is_err(), "{bad}");
        }
    }

    #[test]
    fn goal_verify_bounds() {
        let mut p = minimal("p");
        p.goal_verify = Some(GoalVerify {
            verify: Some("sometimes".into()),
            goal: None,
            judge: None,
            max_iters: None,
            token_budget: None,
        });
        assert!(p.validate().is_err());
        p.goal_verify = Some(GoalVerify {
            verify: Some("on".into()),
            goal: None,
            judge: None,
            max_iters: Some(0),
            token_budget: None,
        });
        assert!(p.validate().is_err());
    }
}
