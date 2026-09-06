// ============================================================================
// API-прокси: единая точка выхода в интернет для всех сервисов.
//
// Что делает и зачем:
//  1) service_request — JS просит «GET yandex /tracks/123/similar», Rust сам
//     достаёт токен из keyring, подставляет нужный формат авторизации
//     (OAuth / Bearer / VK) и выполняет запрос. Токен в веб-слой не попадает.
//  2) resolve_stream — разворачивает трек в поток. Если CDN требует
//     авторизованных заголовков, Rust кладёт реальный URL во внутреннюю
//     карту StreamMap и возвращает JS обезличенный адрес
//     http://stream.localhost/{id} — см. stream_proxy.rs.
// ============================================================================

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::secure_store::load_token_internal;

/// Общий reqwest-клиент (пул соединений, rustls).
pub struct ApiState {
    pub http: reqwest::Client,
}

/// Карта «id прокси-потока → реальный подписанный URL».
pub struct StreamMap(pub Mutex<HashMap<String, String>>);

/// Конфиг авторизации сервиса (какой заголовок строить из токена).
enum AuthKind {
    /// `Authorization: OAuth <token>` — Яндекс Музыка.
    OAuth,
    /// `Authorization: Bearer <token>` — VK.
    Bearer,
}

/// VK audio-API отвечает сторонним токенам (Kate Mobile) только с их UA
/// (практика vk-audio-token). Явно задаём User-Agent для VK-запросов.
const VK_USER_AGENT: &str =
    "KateMobileAndroid/56 lite-460 (Android 13; SDK 33; x86_64; VK4A; en; 320x480)";

/// Публично известный секрет подписи mp3-ссылок клиентов Яндекс Музыки.
const YANDEX_MP3_SECRET: &str = "XcmmKMtZkgcRFeQvPWXezGxpWqhYhVdD";

struct ServiceCfg {
    base: &'static str,
    auth: AuthKind,
    /// VK API требует параметр версии протокола.
    vk_version: bool,
}

fn cfg(service: &str) -> Option<ServiceCfg> {
    match service {
        // Мобильное API Яндекс Музыки: работает с OAuth-токеном приложения
        // Яндекс Музыки (его мы перехватываем при входе). Каждый ответ
        // завёрнут в "result" — разворачивает адаптер на фронтенде.
        "yandex" => Some(ServiceCfg {
            base: "https://api.music.yandex.net",
            auth: AuthKind::OAuth,
            vk_version: false,
        }),
        "vk" => Some(ServiceCfg {
            base: "https://api.vk.com/method",
            auth: AuthKind::Bearer,
            vk_version: true,
        }),
        _ => None,
    }
}

/// Ответ resolve_stream для фронтенда.
#[derive(Serialize, Deserialize)]
pub struct StreamResolve {
    pub url: String,
    pub kind: String, // "mp3" | "hls" | "proxy"
}

#[tauri::command]
pub async fn service_request(
    state: State<'_, ApiState>,
    service: String,
    method: String,
    path: String,
    query: Option<HashMap<String, String>>,
    body: Option<Value>,
) -> Result<Value, String> {
    let cfg = cfg(&service).ok_or_else(|| format!("Неизвестный сервис: {service}"))?;
    let token = load_token_internal(&service)?;

    let url = format!("{}{}", cfg.base, path);
    let mut req = match method.to_uppercase().as_str() {
        "POST" => state.http.post(&url),
        _ => state.http.get(&url),
    };

    // VK: токены мобильных клиентов требуют соответствующего User-Agent.
    if service == "vk" {
        req = req.header("User-Agent", VK_USER_AGENT);
    }
    // Яндекс: часть методов мобильного API отвечает только «клиенту Музыки».
    if service == "yandex" {
        req = req.header("X-Yandex-Music-Client", "YandexMusicAndroid/240236");
        req = req.header("Accept", "application/json");
    }

    if let Some(q) = &query {
        req = req.query(q);
    }
    if cfg.vk_version {
        req = req.query(&[("v", "5.199")]);
    }
    if let Some(b) = &body {
        req = req.json(b);
    }

    // Токен подставляется ЗДЕСЬ, в Rust. Наружу не возвращается никогда.
    if let Some(t) = &token {
        match cfg.auth {
            AuthKind::OAuth => req = req.header("Authorization", format!("OAuth {t}")),
            AuthKind::Bearer => req = req.header("Authorization", format!("Bearer {t}")),
        }
    }

    let resp = req.send().await.map_err(|e| format!("{service} API: {e}"))?;
    let status = resp.status().as_u16();
    let json: Value = resp.json().await.map_err(|e| format!("{service} API decode: {e}"))?;

    if !(200..300).contains(&status) {
        return Err(format!("{service} API {status}: {json}"));
    }
    Ok(json)
}

/// Разворачивание трека в поток (Яндекс — полный двухшаговый алгоритм).
///
/// 1) /tracks/{id}/download-info → JSON с downloadInfoUrl для кодека mp3;
/// 2) GET downloadInfoUrl → XML <host><path><ts><s>;
/// 3) прямая ссылка: https://{host}/get-mp3/{md5(SECRET+ts+path)}/{ts}{path}
///    (секрет — публично известная константа клиентов Яндекс Музыки).
/// Ссылка короткоживущая и секретом аккаунта не является — отдаём напрямую.
#[tauri::command]
pub async fn resolve_stream(
    state: State<'_, ApiState>,
    service: String,
    track_id: String,
) -> Result<StreamResolve, String> {
    let token = load_token_internal(&service)?;

    match service.as_str() {
        "yandex" => {
            let client = || -> reqwest::RequestBuilder {
                let mut r = state
                    .http
                    .get(format!("https://api.music.yandex.net/tracks/{track_id}/download-info"));
                if let Some(t) = &token {
                    r = r.header("Authorization", format!("OAuth {t}"));
                }
                r.header("X-Yandex-Music-Client", "YandexMusicAndroid/240236")
                    .header("Accept", "application/json")
            };

            let resp = client().send().await.map_err(|e| format!("Яндекс: {e}"))?;
            let status = resp.status().as_u16();
            let json: Value = resp.json().await.map_err(|e| format!("Яндекс: decode {e}"))?;
            if !(200..300).contains(&status) {
                return Err(format!("Яндекс API {status}: {json}"));
            }

            let infos = json
                .get("result")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let Some(mp3) = infos
                .iter()
                .find(|i| i.get("codec").and_then(|c| c.as_str()) == Some("mp3"))
                .or_else(|| infos.first())
            else {
                return Err("Яндекс: нет доступного mp3-потока для трека".into());
            };
            let Some(info_url) = mp3.get("downloadInfoUrl").and_then(|v| v.as_str()) else {
                return Err("Яндекс: download-info без ссылки".into());
            };

            // Шаг 2: XML с host/path/ts
            let xml = state
                .http
                .get(info_url)
                .header("User-Agent", "Mozilla/5.0")
                .send()
                .await
                .map_err(|e| format!("Яндекс: {e}"))?
                .text()
                .await
                .map_err(|e| format!("Яндекс: {e}"))?;
            let tag = |name: &str| -> Option<String> {
                let start = format!("<{name}>");
                let end = format!("</{name}>");
                let a = xml.find(&start)? + start.len();
                let b = xml[a..].find(&end)? + a;
                Some(xml[a..b].to_string())
            };
            let (Some(host), Some(path), Some(ts)) = (tag("host"), tag("path"), tag("ts")) else {
                return Err("Яндекс: неожиданный формат download-info XML".into());
            };

            // Шаг 3: подпись md5(секрет + ts + path)
            use md5::{Digest, Md5};
            let mut hasher = Md5::new();
            hasher.update(YANDEX_MP3_SECRET);
            hasher.update(ts.as_bytes());
            hasher.update(path.as_bytes());
            let sign: String = hasher
                .finalize()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect();

            Ok(StreamResolve {
                url: format!("https://{host}/get-mp3/{sign}/{ts}{path}"),
                kind: "mp3".into(),
            })
        }

        other => Err(format!(
            "resolve_stream для {other} не реализован: используйте URL из ответов API сервиса"
        )),
    }
}

/// Зарегистрировать подписанный URL под обезличенным id (для stream-прокси).
/// Возвращает id, по которому фронтенд обращается к http://stream.localhost/{id}.
#[allow(dead_code)] // готовый механизм; включается при подключении сервисов с приватными CDN
pub fn register_stream(streams: &StreamMap, real_url: String) -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};

    let id = format!("{:016x}", RandomState::new().build_hasher().finish());
    streams.0.lock().unwrap().insert(id.clone(), real_url);
    id
}
