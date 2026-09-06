// ============================================================================
// Локальная история прослушиваний и KeyValue-хранилище профиля.
//
// Данные лежат в SQLite (src-tauri/src/db.rs) в каталоге данных приложения.
// В браузерном режиме (без Tauri) прозрачно падаем на localStorage —
// чтобы алгоритм волны можно было разрабатывать в обычном dev-сервере.
// ============================================================================

import { ipc } from "../lib/tauri";

export type PlayEventType =
  | "play" // воспроизведение началось
  | "complete" // дослушано до конца
  | "skip" // пропущено (позиция уточняется полем positionSec)
  | "like" // лайк
  | "unlike"; // лайк снят

// (тип события хранится строкой — движок волны может классифицировать тоньше)

export interface PlayEventRow {
  service: string;
  trackId: string;
  title: string;
  artist: string;
  /** Жанры через запятую. */
  genres: string;
  /** Строка события (play/complete/skip/like/unlike/discover_like/...). */
  event: string;
  positionSec: number;
  createdAt: number;
}

const LS_EVENTS = "volna.fallback.events";
const LS_KV = "volna.fallback.kv";

// --- localStorage-фолбэк -----------------------------------------------------

function lsRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* переполнение квоты игнорируем — это лишь дев-фолбэк */
  }
}

// --- Публичный API ------------------------------------------------------------

export const history = {
  /** Записать событие прослушивания (fire-and-forget). */
  log(row: Omit<PlayEventRow, "createdAt">): void {
    const full: PlayEventRow = { ...row, createdAt: Date.now() };
    // Аргумент заворачивается в ключ `event` — по имени параметра Rust-команды.
    ipc("db_log_event", { event: full }).catch(() => {
      const arr = lsRead<PlayEventRow[]>(LS_EVENTS, []);
      arr.push(full);
      // храним не больше 2000 последних событий
      lsWrite(LS_EVENTS, arr.slice(-2000));
    });
  },

  /** Последние события — используются для восстановления вкусового профиля. */
  async recent(limit = 400): Promise<PlayEventRow[]> {
    try {
      return await ipc<PlayEventRow[]>("db_recent_events", { limit });
    } catch {
      const arr = lsRead<PlayEventRow[]>(LS_EVENTS, []);
      return arr.slice(-limit);
    }
  },

  /** Прочитать JSON-значение из kv-таблицы (настройки, профиль, лайки). */
  async kvGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await ipc<string | null>("db_kv_get", { key });
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return lsRead<Record<string, unknown>>(LS_KV, {})[key] as T ?? null;
    }
  },

  /** Записать JSON-значение в kv-таблицу. */
  async kvSet(key: string, value: unknown): Promise<void> {
    const raw = JSON.stringify(value);
    try {
      await ipc("db_kv_set", { key, value: raw });
    } catch {
      const obj = lsRead<Record<string, unknown>>(LS_KV, {});
      obj[key] = raw;
      lsWrite(LS_KV, obj);
    }
  },
};
