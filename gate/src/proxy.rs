use axum::{
    Json,
    body::Body,
    extract::Request,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

/// Hop-by-hop headers never cross the proxy (RFC 9110 §7.6.1). `host` is
/// rebuilt by the client from the target URL so the engine's own localhost
/// guard keeps passing.
const HOP: &[&str] = &[
    "connection",
    "transfer-encoding",
    "host",
    "keep-alive",
    "proxy-connection",
    "te",
    "trailer",
    "upgrade",
];

/// Strip the mount prefix from an original path+query:
/// `/fourfive/api/health` mounted at `/fourfive` → `/api/health`.
pub fn strip_mount<'a>(path_and_query: &'a str, mount: &str) -> &'a str {
    path_and_query.strip_prefix(mount).unwrap_or(path_and_query)
}

/// Forward one request to `target`, streaming both bodies — never buffering,
/// so SSE (the fourfive message stream) passes through live.
pub async fn forward(client: &reqwest::Client, target: String, req: Request) -> Response {
    let (parts, body) = req.into_parts();
    let mut rb = client
        .request(parts.method, target)
        .body(reqwest::Body::wrap_stream(body.into_data_stream()));
    for (k, v) in &parts.headers {
        if !HOP.contains(&k.as_str()) {
            rb = rb.header(k, v);
        }
    }
    match rb.send().await {
        Ok(up) => {
            let mut out = Response::builder().status(up.status());
            for (k, v) in up.headers() {
                if !HOP.contains(&k.as_str()) {
                    out = out.header(k, v);
                }
            }
            // Headers come straight from a valid upstream response, so the
            // builder cannot fail on them.
            out.body(Body::from_stream(up.bytes_stream()))
                .expect("proxied response rebuild")
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({
                "error": format!(
                    "upstream unreachable ({e}) — is `just up` running all three processes?"
                )
            })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::strip_mount;

    #[test]
    fn mount_stripping() {
        assert_eq!(strip_mount("/fourfive/api/health", "/fourfive"), "/api/health");
        assert_eq!(strip_mount("/fourfive/api/x?q=1", "/fourfive"), "/api/x?q=1");
        assert_eq!(strip_mount("/api/health", "/fourfive"), "/api/health");
    }
}
