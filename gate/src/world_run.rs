//! World-run API (world-run plan W-R1/W-R2): the World view triggers ONE
//! nunc-fluens pipeline run against the LINKED instance and polls its
//! progress — the terminal/systemd runbook stops being the only way to
//! refresh the news. The gate spawns the existing CLI (`NS_INSTANCE=<linked>
//! cli.ts run`) as a managed job, same discipline as the model-download job:
//! one at a time, in-memory state, honest error surface. On success the
//! world exports are restaged (tools/build-world.ts) so the view refreshes.
//! W-R5: the CLI itself refuses non-instances — the gate adds no new write
//! path into a view source.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::GateCfg;

const TAIL_LINES: usize = 40;

#[derive(Debug)]
pub struct RunJob {
    /// running | staging | done | error: <msg>
    pub state: Arc<Mutex<String>>,
    pub lines: Arc<Mutex<VecDeque<String>>>,
    pub started_at: std::time::Instant,
}

fn push_line(lines: &Arc<Mutex<VecDeque<String>>>, line: String) {
    let mut l = lines.lock().unwrap();
    if l.len() >= TAIL_LINES {
        l.pop_front();
    }
    l.push_back(line);
}

async fn drain<R>(reader: R, lines: Arc<Mutex<VecDeque<String>>>)
where
    R: tokio::io::AsyncRead + Unpin,
{
    use tokio::io::AsyncBufReadExt;
    let mut buf = tokio::io::BufReader::new(reader).lines();
    while let Ok(Some(line)) = buf.next_line().await {
        push_line(&lines, line);
    }
}

/// Run one command with output tailing; true on exit 0.
async fn run_step(
    program: &str,
    args: &[&str],
    env: &[(&str, String)],
    lines: &Arc<Mutex<VecDeque<String>>>,
) -> Result<(), String> {
    let mut cmd = tokio::process::Command::new(program);
    cmd.args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    for (k, v) in env {
        cmd.env(k, v);
    }
    let mut child = cmd.spawn().map_err(|e| format!("spawn {program}: {e}"))?;
    let out = child.stdout.take();
    let err = child.stderr.take();
    let (l1, l2) = (lines.clone(), lines.clone());
    let t1 = out.map(|o| tokio::spawn(drain(o, l1)));
    let t2 = err.map(|e| tokio::spawn(drain(e, l2)));
    let status = child.wait().await.map_err(|e| format!("wait: {e}"))?;
    if let Some(t) = t1 {
        let _ = t.await;
    }
    if let Some(t) = t2 {
        let _ = t.await;
    }
    if status.success() {
        Ok(())
    } else {
        Err(format!("{program} exited {}", status.code().unwrap_or(-1)))
    }
}

pub async fn get_run(State(cfg): State<GateCfg>) -> Response {
    let guard = cfg.world_run.lock().unwrap();
    match guard.as_ref() {
        None => Json(json!({ "state": "idle" })).into_response(),
        Some(job) => Json(json!({
            "state": job.state.lock().unwrap().clone(),
            "seconds": job.started_at.elapsed().as_secs(),
            "tail": job.lines.lock().unwrap().iter().cloned().collect::<Vec<_>>(),
        }))
        .into_response(),
    }
}

pub async fn post_run(State(cfg): State<GateCfg>) -> Response {
    let Some(instance) = cfg.news_repo.clone() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "no instance linked - just news-link <instance>",
        )
            .into_response();
    };
    {
        let mut guard = cfg.world_run.lock().unwrap();
        if let Some(job) = guard.as_ref() {
            let s = job.state.lock().unwrap().clone();
            if s == "running" || s == "staging" {
                return (StatusCode::CONFLICT, format!("a run is already {s}")).into_response();
            }
        }
        let job = RunJob {
            state: Arc::new(Mutex::new("running".to_owned())),
            lines: Arc::new(Mutex::new(VecDeque::new())),
            started_at: std::time::Instant::now(),
        };
        let state = job.state.clone();
        let lines = job.lines.clone();
        let inst = instance.to_string_lossy().into_owned();
        tokio::spawn(async move {
            push_line(&lines, format!("[gate] run start: NS_INSTANCE={inst}"));
            let run = run_step(
                "node",
                &["engines/nunc-fluens/pipeline/src/cli.ts", "run"],
                &[("NS_INSTANCE", inst.clone())],
                &lines,
            )
            .await;
            match run {
                Err(e) => *state.lock().unwrap() = format!("error: {e}"),
                Ok(()) => {
                    *state.lock().unwrap() = "staging".to_owned();
                    push_line(&lines, "[gate] run OK - restaging world exports".to_owned());
                    match run_step("node", &["tools/build-world.ts"], &[], &lines).await {
                        Ok(()) => *state.lock().unwrap() = "done".to_owned(),
                        Err(e) => *state.lock().unwrap() = format!("error: staging: {e}"),
                    }
                }
            }
        });
        *guard = Some(job);
    }
    (StatusCode::ACCEPTED, "run started").into_response()
}
