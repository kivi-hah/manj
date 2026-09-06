// ============================================================================
// Локальная БД (SQLite) — история прослушиваний + kv-хранилище.
//
// В таблице play_events копится сырая история (источник вкусового профиля),
// в kv лежат сериализованные состояние: профиль, лайки, настройки UI.
// Файл БД — в каталоге данных приложения (app_data_dir).
// ============================================================================

use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

pub struct DbState(pub Mutex<Connection>);

#[derive(Serialize, Deserialize)]
pub struct PlayEventRow {
    pub service: String,
    #[serde(rename = "trackId")]
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub genres: String,
    pub event: String,
    #[serde(rename = "positionSec")]
    pub position_sec: f64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;

    let conn = Connection::open(dir.join("volna.db"))?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS play_events (
             id           INTEGER PRIMARY KEY AUTOINCREMENT,
             service      TEXT NOT NULL,
             track_id     TEXT NOT NULL,
             title        TEXT NOT NULL,
             artist       TEXT NOT NULL,
             genres       TEXT NOT NULL,
             event        TEXT NOT NULL,
             position_sec REAL NOT NULL DEFAULT 0,
             created_at   INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_play_events_created ON play_events(created_at DESC);
         CREATE TABLE IF NOT EXISTS kv (
             key        TEXT PRIMARY KEY,
             value      TEXT NOT NULL,
             updated_at INTEGER NOT NULL
         );",
    )?;

    app.manage(DbState(Mutex::new(conn)));
    Ok(())
}

// --- Команды истории ------------------------------------------------------------

#[tauri::command]
pub fn db_log_event(state: State<DbState>, event: PlayEventRow) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO play_events (service, track_id, title, artist, genres, event, position_sec, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            event.service,
            event.track_id,
            event.title,
            event.artist,
            event.genres,
            event.event,
            event.position_sec,
            event.created_at,
        ],
    )
    .map_err(|e| format!("db insert: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn db_recent_events(state: State<DbState>, limit: i64) -> Result<Vec<PlayEventRow>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT service, track_id, title, artist, genres, event, position_sec, created_at
             FROM play_events ORDER BY created_at DESC LIMIT ?1",
        )
        .map_err(|e| format!("db select: {e}"))?;

    let rows = stmt
        .query_map([limit], |r| {
            Ok(PlayEventRow {
                service: r.get(0)?,
                track_id: r.get(1)?,
                title: r.get(2)?,
                artist: r.get(3)?,
                genres: r.get(4)?,
                event: r.get(5)?,
                position_sec: r.get(6)?,
                created_at: r.get(7)?,
            })
        })
        .map_err(|e| format!("db map: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("db row: {e}"))?);
    }
    Ok(out)
}

// --- kv-хранилище ------------------------------------------------------------------

#[tauri::command]
pub fn db_kv_get(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT value FROM kv WHERE key = ?1")
        .map_err(|e| format!("db kv get: {e}"))?;
    let mut rows = stmt.query([key]).map_err(|e| format!("db kv get: {e}"))?;
    match rows.next().map_err(|e| format!("db kv get: {e}"))? {
        Some(r) => Ok(Some(r.get(0).map_err(|e| format!("db kv: {e}"))?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn db_kv_set(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO kv (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
        rusqlite::params![key, value, chrono_now()],
    )
    .map_err(|e| format!("db kv set: {e}"))?;
    Ok(())
}

fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
