//! AI run-log viewer API (Phase D, plan PD13): read-only tail views over
//! the JSONL run logs — the main store's `runs/ai-runs.jsonl` (FourFive
//! chat + the agent write there) and, per data instance, its
//! `store/runs/ai-runs.jsonl` (pipeline runs, R3). The instances root
//! arrives as an explicit `--instances-dir` flag — the gate never derives
//! or hardcodes engine layout. Enumerate and read, never write.

use std::path::{Path, PathBuf};

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::Value;

use crate::GateCfg;

const DEFAULT_LIMIT: usize = 100;
const MAX_LIMIT: usize = 1000;

#[derive(Debug, Deserialize)]
pub struct RunsQuery {
    /// "main" (default) or "instance".
    pub source: Option<String>,
    /// Instance name when source = "instance".
    pub instance: Option<String>,
    pub limit: Option<usize>,
}

fn no_store() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        "no data store configured - start the gate with --data-dir (just up passes it)",
    )
        .into_response()
}

/// Instance names double as directory names — same slug rule as
/// profile ids, refused before touching the filesystem.
fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Tail-parse a JSONL file: the last `limit` well-formed rows, oldest
/// first. Malformed lines are skipped, not fatal (the manda posture).
async fn tail_jsonl(path: &Path, limit: usize) -> Result<Vec<Value>, Response> {
    let raw = match tokio::fs::read_to_string(path).await {
        Ok(s) => s,
        Err(_) => return Ok(Vec::new()), // no log yet = empty view
    };
    let rows: Vec<Value> = raw
        .lines()
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .collect();
    let skip = rows.len().saturating_sub(limit);
    Ok(rows.into_iter().skip(skip).collect())
}

pub async fn get_runs(State(cfg): State<GateCfg>, Query(q): Query<RunsQuery>) -> Response {
    let limit = q.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let source = q.source.as_deref().unwrap_or("main");
    let path: PathBuf = match source {
        "main" => {
            let Some(data_dir) = &cfg.data_dir else {
                return no_store();
            };
            data_dir.join("runs").join("ai-runs.jsonl")
        }
        "instance" => {
            let Some(instances_dir) = &cfg.instances_dir else {
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "no instances dir configured - start the gate with --instances-dir",
                )
                    .into_response();
            };
            let Some(name) = q.instance.as_deref() else {
                return (
                    StatusCode::BAD_REQUEST,
                    "source=instance requires ?instance=<name>",
                )
                    .into_response();
            };
            if !valid_name(name) {
                return (
                    StatusCode::BAD_REQUEST,
                    format!("instance must be a lowercase slug ([a-z0-9-]), got {name:?}"),
                )
                    .into_response();
            }
            instances_dir
                .join(name)
                .join("store")
                .join("runs")
                .join("ai-runs.jsonl")
        }
        other => {
            return (
                StatusCode::BAD_REQUEST,
                format!("source must be 'main' or 'instance', got {other:?}"),
            )
                .into_response();
        }
    };
    match tail_jsonl(&path, limit).await {
        Ok(rows) => Json(rows).into_response(),
        Err(r) => r,
    }
}

/// Instance names that have a run log — the viewer's source switcher.
pub async fn list_run_instances(State(cfg): State<GateCfg>) -> Response {
    let Some(instances_dir) = &cfg.instances_dir else {
        return Json(Vec::<String>::new()).into_response();
    };
    let mut out: Vec<String> = Vec::new();
    let mut entries = match tokio::fs::read_dir(instances_dir).await {
        Ok(e) => e,
        Err(_) => return Json(out).into_response(),
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !valid_name(&name) {
            continue;
        }
        let log = entry
            .path()
            .join("store")
            .join("runs")
            .join("ai-runs.jsonl");
        if log.is_file() {
            out.push(name);
        }
    }
    out.sort();
    Json(out).into_response()
}
