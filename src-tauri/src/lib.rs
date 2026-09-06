// ============================================================================
// Volna — точка сборки Tauri-приложения.
//   secure_store  — токены в keyring (чтение только внутри Rust);
//   api_proxy     — прокси API-запросов с подстановкой токенов;
//   stream_proxy  — схема stream:// для авторизованных аудиопотоков;
//   db            — SQLite: история и kv (профиль, настройки, лайки).
// ============================================================================

mod api_proxy;
mod db;
mod oauth;
mod secure_store;
mod stream_proxy;

use api_proxy::{ApiState, StreamMap};
use std::collections::HashMap;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Таймауты обязательны: без них недоступный сервер подвешивает запрос
    // (и выглядит как «приложение не открылось»).
    let http = reqwest::Client::builder()
        .user_agent("Manj/0.1")
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("reqwest client");

    tauri::Builder::default()
        .manage(ApiState { http })
        .manage(StreamMap(Mutex::new(HashMap::new())))
        .setup(|app| {
            // Инициализация SQLite до первых IPC-вызовов фронта.
            db::init(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            secure_store::save_token,
            secure_store::delete_token,
            secure_store::has_token,
            api_proxy::service_request,
            api_proxy::resolve_stream,
            oauth::start_oauth,
            db::db_log_event,
            db::db_recent_events,
            db::db_kv_get,
            db::db_kv_set,
        ])
        // Кастомная схема для аудиопотоков: на Windows доступна как
        // http://stream.localhost/{id}, CSP разрешает media-src.
        .register_asynchronous_uri_scheme_protocol("stream", stream_proxy::handle)
        .run(tauri::generate_context!())
        .expect("ошибка запуска Volna");
}
