import { useEffect } from "react";
import { useUiStore } from "./stores/uiStore";
import { initPlayer, persistSession, usePlayerStore } from "./player/playerStore";
import { useLibraryStore } from "./stores/libraryStore";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { PlayerBar } from "./components/PlayerBar";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { UpdatesOverlay } from "./components/UpdatesOverlay";
import { Toasts } from "./components/Toasts";
import { SettingsOverlay } from "./components/settings/SettingsOverlay";
import { HomeScreen } from "./components/screens/HomeScreen";
import { SearchScreen } from "./components/screens/SearchScreen";
import { LibraryScreen } from "./components/screens/LibraryScreen";
import { LibraryAllScreen } from "./components/screens/LibraryAllScreen";
import { ArtistScreen } from "./components/screens/ArtistScreen";
import { isTauri } from "./lib/tauri";

let appInitialized = false;

export function App() {
  const screen = useUiStore((s) => s.screen);
  const prefs = useUiStore((s) => s.prefs);
  const fullscreenOpen = useUiStore((s) => s.fullscreenOpen);

  // Инициализация: подключения сервисов, вкусо-профиль, библиотека, автозапуск.
  useEffect(() => {
    if (appInitialized) return;
    appInitialized = true;
    void (async () => {
      await useUiStore.getState().initConnections();
      await initPlayer();
      await useLibraryStore.getState().load();
      // Стандартная настройка плеера: авто-включение волны при старте.
      if (useUiStore.getState().prefs.autoPlay) {
        void usePlayerStore.getState().playWave("mix");
      }
    })();

    // Память последнего трека: финальное сохранение при закрытии окна.
    if (isTauri()) {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().onCloseRequested(async (event) => {
          event.preventDefault();
          persistSession();
          // даём IPC-сохранению уйти, затем закрываем принудительно
          setTimeout(() => void getCurrentWindow().destroy(), 150);
        });
      });
    }
  }, []);

  // Горячие клавиши (список — в Настройки → Горячие клавиши).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const player = usePlayerStore.getState();
      switch (e.code) {
        case "Space":
          e.preventDefault();
          player.toggle();
          break;
        case "ArrowRight":
          player.seek(player.position + 5);
          break;
        case "ArrowLeft":
          player.seek(player.position - 5);
          break;
        case "Escape":
          useUiStore.getState().setFullscreenOpen(false);
          useUiStore.getState().setUpdatesOpen(false);
          useUiStore.getState().closeSettings();
          break;
        case "KeyS":
          if (e.ctrlKey) {
            e.preventDefault();
            useUiStore.getState().openSettings("integrations");
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`h-full w-full overflow-hidden bg-base ${prefs.animations ? "" : "no-anim"}`}>
      <TitleBar />

      <div className="flex h-full">
        <Sidebar />

        <main className="min-w-0 flex-1 pb-[128px] pr-6 pt-12">
          {/* Большая тёмная карточка экрана, как в макете */}
          <div className="h-full overflow-y-auto overflow-x-hidden rounded-card bg-surface">
            <div key={screen} className="animate-screen h-full">
              {screen === "home" && <HomeScreen />}
              {screen === "search" && <SearchScreen />}
              {screen === "library" && <LibraryScreen />}
              {screen === "library-all" && <LibraryAllScreen />}
              {screen === "artist" && <ArtistScreen />}
            </div>
          </div>
        </main>
      </div>

      <PlayerBar />
      {fullscreenOpen && <FullscreenPlayer />}
      <SettingsOverlay />
      <UpdatesOverlay />
      <Toasts />

      {/* Индикатор dev-режима в браузере (без Tauri API) */}
      {!isTauri() && (
        <div className="fixed right-3 top-14 z-40 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/60">
          browser dev — IPC недоступен
        </div>
      )}
    </div>
  );
}
