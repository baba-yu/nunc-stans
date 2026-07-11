use std::{path::PathBuf, sync::Arc};

use axum::{
    Json, Router,
    extract::{Path as UrlPath, Request, State},
    http::{StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::Mutex;
use tower_http::services::ServeDir;
use uuid::Uuid;

use crate::{
    edge::{Author, Edge, EdgeType},
    store::SelfStore,
    superposition::{self, Superposition},
};

#[derive(Clone)]
struct App {
    store: Arc<Mutex<SelfStore>>,
}

pub fn router(self_dir: PathBuf, static_dir: Option<PathBuf>) -> anyhow::Result<Router> {
    let store = SelfStore::open(self_dir)?;
    // Refuse to serve an unsafe vault (not a repo root, or has a remote): the
    // engine is the writer, so it enforces F11 rather than trusting setup.
    store.check_vault_safety()?;
    let app = App { store: Arc::new(Mutex::new(store)) };
    let mut router = Router::new()
        .route("/health", get(health))
        .route("/self/commitments", get(list_commitments).post(create_commitment))
        .route("/self/edges", get(list_edges).post(append_edge))
        .route("/self/outcomes", post(append_outcome))
        .route("/self/outcomes/{slug}", get(list_outcomes))
        .route(
            "/self/superposition_state",
            get(list_superposition).post(create_superposition),
        )
        .with_state(app);
    if let Some(dir) = static_dir {
        router = router.fallback_service(ServeDir::new(dir));
    }
    // The self scope is a sovereignty vault: no CORS is offered at all (the
    // ME view is served same-origin by this engine), and the Host guard
    // keeps DNS-rebinding pages from addressing the API through a public
    // hostname that resolves to loopback.
    Ok(router.layer(middleware::from_fn(require_local_host)))
}

async fn require_local_host(req: Request, next: Next) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    let name = host.rsplit_once(':').map(|(h, _)| h).unwrap_or(host);
    if matches!(name, "127.0.0.1" | "localhost") {
        next.run(req).await
    } else {
        err(
            StatusCode::FORBIDDEN,
            "the engine only answers when addressed as localhost (DNS-rebinding guard)",
        )
    }
}

fn err(status: StatusCode, msg: impl Into<String>) -> Response {
    (status, Json(json!({ "error": msg.into() }))).into_response()
}

fn internal(e: impl std::fmt::Display) -> Response {
    err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

async fn health() -> Json<Value> {
    Json(json!({
        "ok": true,
        "engine": "nunc-stans-engine",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn list_commitments(State(app): State<App>) -> Response {
    let store = app.store.lock().await;
    match store.list_commitments() {
        Ok(r) => Json(json!({ "commitments": r.values, "malformed_skipped": r.malformed }))
            .into_response(),
        Err(e) => internal(e),
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct NewCommitment {
    slug: String,
    title: String,
    started_at: String,
    #[serde(default)]
    resources: Resources,
    note: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
struct Resources {
    money_jpy: Option<i64>,
    hours: Option<f64>,
}

pub fn valid_slug(s: &str) -> bool {
    // Length bound keeps an over-long-but-character-valid slug from reaching
    // the filesystem and failing with ENAMETOOLONG (a 500); it stays a 422.
    !s.is_empty()
        && s.len() <= 100
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

async fn create_commitment(
    State(app): State<App>,
    Json(input): Json<NewCommitment>,
) -> Response {
    if !valid_slug(&input.slug) {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "slug must be [a-z0-9-]+");
    }
    if input.title.trim().is_empty() {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "title must be non-empty");
    }
    if input.started_at.trim().is_empty() {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "started_at must be non-empty");
    }
    let store = app.store.lock().await;
    if store.commitment_exists(&input.slug) {
        return err(
            StatusCode::CONFLICT,
            "commitment already exists; records are append-only — supersede instead of editing",
        );
    }
    let id = format!("self/commitment/{}", input.slug);
    let doc = json!({
        "id": id,
        "title": input.title,
        "started_at": input.started_at,
        "resources": { "money_jpy": input.resources.money_jpy, "hours": input.resources.hours },
        "note": input.note,
    });
    if let Err(e) = store.create_commitment(&input.slug, &doc) {
        return internal(e);
    }
    let vaulted = store.vault_commit(&format!("ns: commitment_authored {id}"));
    (
        StatusCode::CREATED,
        Json(json!({ "id": id, "vault_committed": vaulted })),
    )
        .into_response()
}

async fn list_edges(State(app): State<App>) -> Response {
    let store = app.store.lock().await;
    match store.read_edges() {
        Ok((edges, malformed)) => {
            Json(json!({ "edges": edges, "malformed_skipped": malformed })).into_response()
        }
        Err(e) => internal(e),
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct NewEdge {
    #[serde(rename = "type")]
    edge_type: EdgeType,
    from: String,
    to: String,
    to_label: String,
    from_label: Option<String>,
    note: Option<String>,
    author: Author,
}

async fn append_edge(State(app): State<App>, Json(input): Json<NewEdge>) -> Response {
    let edge = Edge {
        id: Uuid::new_v4().to_string(),
        edge_type: input.edge_type,
        from: input.from,
        to: input.to,
        to_label: input.to_label,
        from_label: input.from_label,
        author: input.author,
        created_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
        note: input.note,
    };
    if let Err(msg) = edge.validate() {
        return err(StatusCode::UNPROCESSABLE_ENTITY, msg);
    }
    let store = app.store.lock().await;
    if let Err(e) = store.append_edge(&edge) {
        return internal(e);
    }
    let vaulted = store.vault_commit(&format!("ns: edge_appended {}", edge.id));
    (
        StatusCode::CREATED,
        Json(json!({ "edge": edge, "vault_committed": vaulted })),
    )
        .into_response()
}

/// The subjective component's vocabulary is closed (prd-override §1.1);
/// the observable component's vocabulary is extensible, so only its shape
/// is checked. `still_open` is a status, not a terminal result.
const SUBJECTIVE_RESULTS: [&str; 4] = ["happy", "unhappy", "unchanged", "refused_to_judge"];

pub fn validate_outcome(component: &str, result: &str) -> Result<(), String> {
    match component {
        "subjective" => {
            if SUBJECTIVE_RESULTS.contains(&result) {
                Ok(())
            } else {
                Err(format!(
                    "subjective result must be one of {SUBJECTIVE_RESULTS:?}"
                ))
            }
        }
        "observable" => {
            if !result.is_empty()
                && result.chars().all(|c| c.is_ascii_lowercase() || c == '_')
            {
                Ok(())
            } else {
                Err("observable result must be a lowercase_snake token".into())
            }
        }
        _ => Err("component must be 'observable' or 'subjective'".into()),
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct NewOutcome {
    commitment_slug: String,
    component: String,
    result: String,
    note: Option<String>,
}

async fn append_outcome(State(app): State<App>, Json(input): Json<NewOutcome>) -> Response {
    if !valid_slug(&input.commitment_slug) {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "commitment_slug must be [a-z0-9-]+");
    }
    if let Err(msg) = validate_outcome(&input.component, &input.result) {
        return err(StatusCode::UNPROCESSABLE_ENTITY, msg);
    }
    let store = app.store.lock().await;
    if !store.commitment_exists(&input.commitment_slug) {
        return err(StatusCode::NOT_FOUND, "no such commitment");
    }
    let id = format!("self/commitment/{}", input.commitment_slug);
    let doc = json!({
        "commitment": id,
        "component": input.component,
        "result": input.result,
        "note": input.note,
        "recorded_at": Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
    });
    match store.append_outcome(&input.commitment_slug, &input.component, doc) {
        Ok(file) => {
            let vaulted =
                store.vault_commit(&format!("ns: commitment_close_recorded {id} ({})", input.component));
            (
                StatusCode::CREATED,
                Json(json!({ "outcome": file, "commitment": id, "vault_committed": vaulted })),
            )
                .into_response()
        }
        Err(e) => internal(e),
    }
}

async fn list_outcomes(State(app): State<App>, UrlPath(slug): UrlPath<String>) -> Response {
    if !valid_slug(&slug) {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "slug must be [a-z0-9-]+");
    }
    let store = app.store.lock().await;
    match store.list_outcomes(&slug) {
        Ok(r) => Json(json!({ "outcomes": r.values, "malformed_skipped": r.malformed }))
            .into_response(),
        Err(e) => internal(e),
    }
}

// --- superposition_state lane (Phase F, F-3) ---------------------------
//
// The AI's strategy understanding, saved as grounds for a decision. On create
// the engine draws the `informed_by` edge to the artifact it read (journey
// T11's full form) — that edge is the canonical link (§10-A); a re-authored
// version additionally draws a `supersedes` edge to the prior. author=ai is an
// asserted field (no caller auth on the self engine — agent-abi §5 gap 1);
// grounding ⊆ declared is enforced upstream (FourFive parseStrategyCard), not
// here (the engine has no cross-scope metric read).

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct NewSuperposition {
    /// Optional stable id (a slug); a uuid is minted when absent.
    id: Option<String>,
    win: String,
    constraint: String,
    risk_to_watch: String,
    grounding: Vec<String>,
    /// The artifact scope id read: artifact/artifact_version/<slug>@v<N>.
    informed_by: String,
    informed_by_label: String,
    /// The prior superposition_state id this version supersedes (versioning).
    supersedes: Option<String>,
    cites_close: Option<String>,
    note: Option<String>,
}

async fn create_superposition(
    State(app): State<App>,
    Json(input): Json<NewSuperposition>,
) -> Response {
    let slug = match input.id {
        Some(s) => {
            if !valid_slug(&s) {
                return err(StatusCode::UNPROCESSABLE_ENTITY, "id must be [a-z0-9-]+");
            }
            s
        }
        None => Uuid::new_v4().to_string(),
    };
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let record = Superposition {
        id: format!("self/{}/{}", superposition::NODE_TYPE, slug),
        win: input.win,
        constraint: input.constraint,
        risk_to_watch: input.risk_to_watch,
        grounding: input.grounding,
        informed_by: input.informed_by,
        informed_by_label: input.informed_by_label,
        author: Author::Ai,
        created_at: now.clone(),
        supersedes: input.supersedes.clone(),
        cites_close: input.cites_close,
        note: input.note,
    };
    if let Err(msg) = record.validate() {
        return err(StatusCode::UNPROCESSABLE_ENTITY, msg);
    }
    let doc = match serde_json::to_value(&record) {
        Ok(v) => v,
        Err(e) => return internal(e),
    };
    let store = app.store.lock().await;
    if store.doc_exists(superposition::NODE_TYPE, &slug) {
        return err(
            StatusCode::CONFLICT,
            "superposition_state already exists; records are append-only — supersede instead",
        );
    }
    if let Err(e) = store.create_doc(superposition::NODE_TYPE, &slug, &doc) {
        return internal(e);
    }
    // The canonical link (§10-A): informed_by → the artifact this read.
    let informed = Edge {
        id: Uuid::new_v4().to_string(),
        edge_type: EdgeType::InformedBy,
        from: record.id.clone(),
        to: record.informed_by.clone(),
        to_label: record.informed_by_label.clone(),
        from_label: None,
        author: Author::Ai,
        created_at: now.clone(),
        note: None,
    };
    if let Err(msg) = informed.validate() {
        // Should be unreachable (validate() checked the artifact id) — surface
        // rather than silently drop the link.
        return err(StatusCode::UNPROCESSABLE_ENTITY, format!("informed_by edge invalid: {msg}"));
    }
    if let Err(e) = store.append_edge(&informed) {
        return internal(e);
    }
    // A re-authored version supersedes the prior (a versioned chain).
    if let Some(prior) = record.supersedes.as_deref() {
        let sup = Edge {
            id: Uuid::new_v4().to_string(),
            edge_type: EdgeType::Supersedes,
            from: record.id.clone(),
            to: prior.to_string(),
            to_label: "prior strategy read-out".into(),
            from_label: None,
            author: Author::Ai,
            created_at: now.clone(),
            note: None,
        };
        if let Err(msg) = sup.validate() {
            return err(StatusCode::UNPROCESSABLE_ENTITY, format!("supersedes edge invalid: {msg}"));
        }
        if let Err(e) = store.append_edge(&sup) {
            return internal(e);
        }
    }
    let vaulted = store.vault_commit(&format!("ns: superposition_saved {}", record.id));
    (
        StatusCode::CREATED,
        Json(json!({
            "id": record.id,
            "informed_by_edge": informed.id,
            "vault_committed": vaulted
        })),
    )
        .into_response()
}

async fn list_superposition(State(app): State<App>) -> Response {
    let store = app.store.lock().await;
    match store.list_docs(superposition::NODE_TYPE) {
        Ok(r) => Json(json!({ "superposition_state": r.values, "malformed_skipped": r.malformed }))
            .into_response(),
        Err(e) => internal(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_rules() {
        assert!(valid_slug("2025-08-gpu-server"));
        assert!(!valid_slug(""));
        assert!(!valid_slug("Has-Upper"));
        assert!(!valid_slug("dots.not.allowed"));
        assert!(!valid_slug("../escape"));
    }

    #[test]
    fn outcome_vocabulary() {
        assert!(validate_outcome("subjective", "happy").is_ok());
        assert!(validate_outcome("subjective", "refused_to_judge").is_ok());
        assert!(validate_outcome("subjective", "satisfied").is_err()); // closed set
        assert!(validate_outcome("observable", "partially_confirmed").is_ok());
        assert!(validate_outcome("observable", "Confirmed!").is_err()); // shape only
        assert!(validate_outcome("felt", "happy").is_err());
    }
}
