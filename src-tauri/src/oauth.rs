// ============================================================================
// Вход в сервисы прямо из приложения — как в Mimoza/Lane.
//
// Схема: встроенное окно-браузер открывает страницу входа сервиса; после
// авторизации сервис редиректит с токеном в URL (fragment или query),
// Rust ПЕРЕХВАТЫВАЕТ этот переход, кладёт токен в keyring, шлёт событие
// oauth-result и закрывает окно. Токен в веб-слой не попадает.
//
// Используемые OAuth-клиенты — общепринятая практика сторонних плееров:
//  — Яндекс: client_id официального приложения Яндекс Музыки
//    (23cabbbdc6cd418abb4b39c32c41195d; так делает yandex-music-api).
//    После входа редирект на https://music.yandex.ru/#access_token=… .
//  — VK: client_id Kate Mobile (2685278) со scope=audio и redirect на
//    oauth.vk.com/blank.html#access_token=… (см. проект vk-audio-token).
//    VK периодически ограничивает audio-API для сторонних токенов — если
//    вход перестанет работать, client_id заменяется одной константой ниже.
// ============================================================================

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const VK_CLIENT_ID: &str = "2685278";
const YANDEX_MUSIC_CLIENT_ID: &str = "23cabbbdc6cd418abb4b39c32c41195d";
const SPOTIFY_CLIENT_ID: &str = "";
const SOUNDCLOUD_CLIENT_ID: &str = "";

/// Служебный хост из старой схемы (на всякий случай перехватываем и его).
const REDIRECT_HOST: &str = "https://volna.local/oauth";

fn login_url(service: &str) -> Result<String, String> {
    match service {
        // ЯНДЕКС: OAuth implicit с client_id приложения Яндекс Музыки — так
        // получает токен сам веб-плеер. В профиле окна уже лежит сессия сайта
        // (мы открывали music.yandex.ru), поэтому Яндекс выдаёт токен
        // БЕСШУМНО и сразу редиректит с #access_token — перехватим его.
        // Если сессии нет — покажется штатная страница входа Яндекса.
        "yandex" => Ok(format!(
            "https://oauth.yandex.ru/authorize?response_type=token&client_id={YANDEX_MUSIC_CLIENT_ID}&redirect_uri=https%3A%2F%2Fmusic.yandex.ru"
        )),
        "vk" => Ok(format!(
            "https://oauth.vk.com/authorize?client_id={VK_CLIENT_ID}&scope=audio&redirect_uri=https%3A%2F%2Foauth.vk.com%2Fblank.html&response_type=token"
        )),
        "spotify" if !SPOTIFY_CLIENT_ID.is_empty() => Ok(format!(
            "https://accounts.spotify.com/authorize?response_type=code&client_id={SPOTIFY_CLIENT_ID}&scope=user-library-read%20user-read-email%20streaming&redirect_uri={REDIRECT_HOST}/spotify"
        )),
        "soundcloud" if !SOUNDCLOUD_CLIENT_ID.is_empty() => Ok(format!(
            "https://secure.soundcloud.com/authorize?response_type=token&client_id={SOUNDCLOUD_CLIENT_ID}&redirect_uri={REDIRECT_HOST}/soundcloud"
        )),
        other => Err(format!(
            "Вход через «{other}» пока не настроен: нужны client_id зарегистрированных приложений \
             (src-tauri/src/oauth.rs). Приложение работает в демо-режиме — без аккаунта."
        )),
    }
}

/// Достать access_token (fragment/query) или code (?code=) из URL перехода.
fn extract_credential(url: &url::Url) -> Option<(String, String)> {
    for pair in url.fragment().unwrap_or("").split('&') {
        if let Some(v) = pair.strip_prefix("access_token=") {
            if !v.is_empty() {
                return Some(("token".to_string(), v.to_string()));
            }
        }
    }
    for pair in url.query().unwrap_or("").split('&') {
        if let Some(v) = pair.strip_prefix("access_token=") {
            if !v.is_empty() {
                return Some(("token".to_string(), v.to_string()));
            }
        }
        if let Some(v) = pair.strip_prefix("code=") {
            if !v.is_empty() {
                return Some(("code".to_string(), v.to_string()));
            }
        }
    }
    None
}

#[tauri::command]
pub async fn start_oauth(app: AppHandle, service: String) -> Result<(), String> {
    let url = login_url(&service)?;
    let label = format!("oauth-{service}");

    // Окно уже открыто — просто поднимем его наверх.
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let parsed_url: url::Url = url.parse().map_err(|e| format!("{e}"))?;

    let svc = service.clone();
    let handle = app.clone();
    let nav_svc = svc.clone();
    let redirect_host = REDIRECT_HOST.to_string();

    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
        .title(format!("Вход — {service}"))
        .inner_size(520.0, 720.0)
        .on_navigation(move |nav| {
            let s = nav.as_str();

            // Служебный адрес старой схемы: просто закрываем окно.
            if s.starts_with(&format!("{redirect_host}/")) {
                if let Some(w) = handle.get_webview_window(&format!("oauth-{nav_svc}")) {
                    let _ = w.close();
                }
                return false;
            }

            // --- Перехват access_token/code в redirect ---------------------
            // Яндекс: oauth.yandex.ru → music.yandex.ru#access_token=…
            // VK: oauth.vk.com/blank.html#access_token=…
            if let Some((kind, value)) = extract_credential(nav) {
                let result = match kind.as_str() {
                    "token" => crate::secure_store::save_token(nav_svc.clone(), value),
                    _ => Err("Получен код авторизации вместо токена: обмен кода (PKCE) будет добавлен"
                        .to_string()),
                };
                let (ok, message) = match result {
                    Ok(()) => (true, format!("Вход в «{nav_svc}» выполнен")),
                    Err(e) => (false, e),
                };
                let _ = handle.emit(
                    "oauth-result",
                    serde_json::json!({ "service": nav_svc, "ok": ok, "message": message }),
                );
                if let Some(w) = handle.get_webview_window(&format!("oauth-{nav_svc}")) {
                    let _ = w.close();
                }
                return false;
            }

            true // обычная навигация (страницы входа, капчи, 2FA) — пропускаем
        })
        .build()
        .map_err(|e| format!("Не удалось открыть окно входа: {e}"))?;

    let _ = window.set_focus();
    Ok(())
}
