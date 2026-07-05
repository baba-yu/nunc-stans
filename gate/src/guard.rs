use axum::{
    Json,
    extract::Request,
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

/// Same posture as the engine's guard: the gate only answers when addressed
/// as localhost, so a DNS-rebinding page resolving to loopback cannot reach
/// the API through a public hostname. (The engine keeps its own copy of this
/// guard behind the gate — defense in depth.)
pub async fn require_local_host(req: Request, next: Next) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    let name = host.rsplit_once(':').map(|(h, _)| h).unwrap_or(host);
    if matches!(name, "127.0.0.1" | "localhost") {
        next.run(req).await
    } else {
        (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "the gate only answers when addressed as localhost (DNS-rebinding guard)"
            })),
        )
            .into_response()
    }
}
