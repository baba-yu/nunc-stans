mod api;
mod edge;
mod store;

use std::net::SocketAddr;
use std::path::PathBuf;

use clap::Parser;

#[derive(Parser)]
#[command(name = "nuncstans-engine", version)]
struct Args {
    /// Path to the self data store. The source of truth lives outside this
    /// repository (F11) and is only ever passed in explicitly (FD-3.2).
    #[arg(long)]
    self_dir: PathBuf,
    /// Optional directory of static files to serve at / (the ME view).
    #[arg(long)]
    static_dir: Option<PathBuf>,
    #[arg(long, default_value_t = 8720)]
    port: u16,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let args = Args::parse();
    let app = api::router(args.self_dir, args.static_dir)?;

    // The self scope is local-first (F11): bind loopback only, never 0.0.0.0.
    let addr = SocketAddr::from(([127, 0, 0, 1], args.port));
    tracing::info!("nuncstans-engine v0 listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
