// ============================================================================
// UI-состояние: активный экран, оверлеи, предпочтения, подключения сервисов,
// тосты. Предпочтения и статусы подключений персистятся через kv (SQLite).
// ============================================================================

import { create } from "zustand";
import type { ServiceId } from "../types/music";
import { SERVICE_IDS } from "../types/music";
import { history } from "../db/history";
import { connectedServices } from "../lib/secure";

export type Screen = "home" | "search" | "library" | "library-all" | "artist";
/** null = корневое меню настроек (как в макете). */
export type SettingsSection =
  | "integrations"
  | "appearance"
  | "player"
  | "hotkeys"
  | "transitions"
  | null;

/** Цветовая версия логотипа (файлы Group-2/3/6 из загрузок). */
export type LogoId = "gray" | "peach" | "olive";

/** Контекст открытой страницы артиста. */
export interface ArtistPage {
  serviceId: ServiceId;
  artistId?: string;
  name: string;
}

export interface Prefs {
  /** «Плавные переходы»: анимации интерфейса. */
  animations: boolean;
  /** Демо-режим: локальный каталог вместо подключённых аккаунтов. */
  demoMode: boolean;
  /** Плавный переход между треками (crossfade). */
  crossfade: boolean;
  crossfadeSec: number;
  /** Компактный сайдбар. */
  compactSidebar: boolean;
  /** Цвет логотипа (Внешний вид). */
  logoId: LogoId;
  /** Повторять очередь с начала, когда волна кончилась. */
  repeatQueue: boolean;
  /** Автозапуск волны при старте приложения. */
  autoPlay: boolean;
}

export interface Toast {
  id: number;
  text: string;
}

interface UiStore {
  screen: Screen;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  fullscreenOpen: boolean;
  updatesOpen: boolean;
  /** Открытая страница артиста (экран «artist»). */
  artistPage: ArtistPage | null;
  prefs: Prefs;
  connections: Record<ServiceId, boolean>;
  toasts: Toast[];

  setScreen(screen: Screen): void;
  openArtist(page: ArtistPage): void;
  closeArtist(): void;
  openSettings(section?: SettingsSection): void;
  closeSettings(): void;
  setFullscreenOpen(open: boolean): void;
  setUpdatesOpen(open: boolean): void;
  setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  initConnections(): Promise<void>;
  toast(text: string): void;
  dismissToast(id: number): void;
}

const DEFAULT_PREFS: Prefs = {
  animations: true,
  demoMode: true,
  crossfade: false,
  crossfadeSec: 3,
  compactSidebar: false,
  logoId: "gray",
  repeatQueue: false,
  autoPlay: false,
};

let toastSeq = 0;

export const useUiStore = create<UiStore>((set, get) => ({
  screen: "home",
  settingsOpen: false,
  settingsSection: null,
  fullscreenOpen: false,
  updatesOpen: false,
  artistPage: null,
  prefs: DEFAULT_PREFS,
  connections: { yandex: false, vk: false },
  toasts: [],

  setScreen: (screen) => set({ screen }),

  openArtist: (artistPage) => set({ artistPage, screen: "artist" }),

  closeArtist: () => set({ artistPage: null, screen: "library" }),

  openSettings: (section?) =>
    set((s) => ({ settingsOpen: true, settingsSection: section ?? null })),

  closeSettings: () => set({ settingsOpen: false }),

  setFullscreenOpen: (fullscreenOpen) => set({ fullscreenOpen }),

  setUpdatesOpen: (updatesOpen) => set({ updatesOpen }),

  setPref: (key, value) => {
    const prefs = { ...get().prefs, [key]: value };
    set({ prefs });
    void history.kvSet("ui_prefs", prefs);
  },

  initConnections: async () => {
    // Восстанавливаем предпочтения и реальные статусы подключений.
    const saved = await history.kvGet<Prefs>("ui_prefs");
    if (saved) set({ prefs: { ...DEFAULT_PREFS, ...saved } });
    const connections = { ...get().connections, ...(await connectedServices()) };
    set({ connections });
  },

  toast: (text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => get().dismissToast(id), 4500);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Утилита для не-React модулей (плеер, движок): показать ошибку пользователю.
export function toastError(text: string): void {
  useUiStore.getState().toast(text);
}

export function toastInfo(text: string): void {
  useUiStore.getState().toast(text);
}

// SERVICE_IDS переэкспортирован для удобства подписок компонентов.
export { SERVICE_IDS };
