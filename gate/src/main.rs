use std::net::SocketAddr;
use std::path::PathBuf;

use clap::Parser;
use nunc_stans_gate::{GateCfg, build_router};

#[derive(Parser)]
#[command(name = "nunc-stans-gate", version)]
struct Args {
    /// Port the single origin listens on (the address you open).
    #[arg(long, default_value_t = 8720)]
    port: u16,
    /// Ledger engine base URL (loopback).
    #[arg(long, default_value = "http://127.0.0.1:8721")]
    engine_url: String,
    /// FourFive server base URL (loopback).
    #[arg(long, default_value = "http://127.0.0.1:8787")]
    fourfive_url: String,
    /// apps-host base URL (loopback) — the generated-app host (Phase E).
    #[arg(long, default_value = "http://127.0.0.1:8788")]
    apps_url: String,
    /// Built Nunc Stans Formans dist directory (FD-3.2: paths only by flag).
    #[arg(long)]
    formans_dist: PathBuf,
    /// Built FourFive dist directory.
    #[arg(long)]
    fourfive_dist: PathBuf,
    /// User-designated data store (workspace model). Empty ⇒ the news
    /// settings API answers 503. `just up` passes the configured store.
    #[arg(long, default_value = "")]
    data_dir: String,
    /// nunc-fluens instances home (the run-log viewer's per-instance
    /// source; an explicit handoff — the gate never derives engine
    /// layout). Empty ⇒ main-store logs only. `just up` passes it.
    #[arg(long, default_value = "")]
    instances_dir: String,
    /// The linked nunc-fluens instance (world-view source) — where the
    /// topics API reads/writes news-topics.json. Empty ⇒ topics API 503s.
    /// `just up` resolves `news_repo` and passes it.
    #[arg(long, default_value = "")]
    news_repo: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let args = Args::parse();
    let data_dir = if args.data_dir.trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(args.data_dir))
    };
    let instances_dir = if args.instances_dir.trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(args.instances_dir))
    };
    let news_repo = if args.news_repo.trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(args.news_repo))
    };
    let cfg = GateCfg::new(args.engine_url, args.fourfive_url, args.formans_dist)
        .with_apps_url(args.apps_url)
        .with_data_dir(data_dir)
        .with_instances_dir(instances_dir)
        .with_news_repo(news_repo);
    let app = build_router(cfg, &args.fourfive_dist);

    // The screen is a single origin on localhost (§10-B): loopback only.
    let addr = SocketAddr::from(([127, 0, 0, 1], args.port));
    tracing::info!("nunc-stans-gate listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
