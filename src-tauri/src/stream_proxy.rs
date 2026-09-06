// ============================================================================
// stream:// — прокси аудиопотоков.
//
// Зачем: некоторые CDN требуют авторизованных заголовков/cookies. Тогда
// реальный URL хранится в StreamMap (Rust), а фронтенд получает адрес
// http://stream.localhost/{id}. Заголовки подставляет Rust при проксировании,
// и подписанный URL так и не попадает в веб-слой.
//
// ВАЖНО для перемотки: прозрачна проксируется заголовок Range — медиаэлемент
// шлёт запросы диапазонов, и мы буферизуем только запрошенный кусок,
// а не весь файл.
// ============================================================================

use std::collections::HashMap;
use std::sync::OnceLock;

use tauri::http::{Request, Response, StatusCode};
use tauri::Manager;

use crate::api_proxy::StreamMap;

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Volna/0.1")
            .build()
            .expect("reqwest client")
    })
}

/// Обработчик схемы. Регистрируется в lib.rs:
///   .register_asynchronous_uri_scheme_protocol("stream", handle)
pub fn handle(
    ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let map: HashMap<String, String> = ctx
        .app_handle()
        .state::<StreamMap>()
        .0
        .lock()
        .unwrap()
        .clone();

    tauri::async_runtime::spawn(async move {
        let response = proxy(request, &map).await;
        responder.respond(response);
    });
}

async fn proxy(request: Request<Vec<u8>>, map: &HashMap<String, String>) -> Response<Vec<u8>> {
    // Адрес вида /{id}
    let id = request.uri().path().trim_start_matches('/').to_string();

    let Some(upstream) = map.get(&id) else {
        return not_found();
    };

    // Прокидываем Range (переключение позиций в плеере).
    let range = request
        .headers()
        .get("range")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let mut req = client().get(upstream);
    if let Some(r) = &range {
        req = req.header("Range", r);
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            return plain_response(StatusCode::BAD_GATEWAY, format!("upstream error: {e}").into_bytes());
        }
    };

    // Копируем значимые заголовки вручную — типы http-крейтов reqwest и tauri
    // не обязаны совпадать по версиям.
    let mut builder = Response::builder().status(StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::OK));
    for header in ["content-type", "content-length", "content-range", "accept-ranges"] {
        if let Some(v) = resp.headers().get(header).and_then(|v| v.to_str().ok()) {
            builder = builder.header(header, v);
        }
    }
    builder = builder.header("access-control-allow-origin", "*");

    let bytes = resp.bytes().await.unwrap_or_default().to_vec();
    builder.body(bytes).unwrap_or_else(|_| not_found())
}

fn not_found() -> Response<Vec<u8>> {
    plain_response(StatusCode::NOT_FOUND, b"stream not found".to_vec())
}

fn plain_response(status: StatusCode, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain")
        .body(body)
        .unwrap()
}
