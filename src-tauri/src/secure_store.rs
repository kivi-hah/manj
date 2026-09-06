// ============================================================================
// Безопасное хранение токенов через системный keyring.
//
// МОДЕЛЬ БЕЗОПАСНОСТИ (важно):
//   Наружу (в веб-слой) экспортированы ТОЛЬКО save_token / delete_token /
//   has_token. Команды get/load НЕТ и не должно быть: чтение токена
//   выполняется исключительно внутри Rust (api_proxy::load_token_internal).
//   Таким образом JS-слой физически не может получить значение токена.
//
// Токены лежат в: Windows Credential Manager / macOS Keychain / Linux
// Secret Service. Ничего не пишем в файлы и в tauri-plugin-store.
// ============================================================================

use keyring::Entry;

const APP_NAME: &str = "volna";

fn entry(service: &str) -> Result<Entry, String> {
    // Имя записи — id сервиса, владелец — приложение.
    Entry::new(APP_NAME, service).map_err(|e| format!("keyring init: {e}"))
}

/// Сохранить токен сервиса (вызывается после OAuth-входа).
#[tauri::command]
pub fn save_token(service: String, token: String) -> Result<(), String> {
    entry(&service)?
        .set_password(&token)
        .map_err(|e| format!("keyring set: {e}"))
}

/// Удалить токен (выход из сервиса).
#[tauri::command]
pub fn delete_token(service: String) -> Result<(), String> {
    match entry(&service)?.delete_credential() {
        Ok(()) => Ok(()),
        // Нет записи — считаем, что удалять нечего, это не ошибка.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {e}")),
    }
}

/// Факт наличия токена (без раскрытия значения) — для UI-статусов.
#[tauri::command]
pub fn has_token(service: String) -> Result<bool, String> {
    match entry(&service)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("keyring get: {e}")),
    }
}

// --- Внутренний доступ (НЕ tauri::command — наружу не экспортируется!) --------

pub fn load_token_internal(service: &str) -> Result<Option<String>, String> {
    match entry(service)?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get: {e}")),
    }
}
