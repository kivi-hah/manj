import { useEffect, useState, type ReactNode } from "react";
import { useUiStore, type SettingsSection, type LogoId } from "../../stores/uiStore";
import { LOGO_VARIANTS } from "../../lib/palette";
import { useExitAnimation } from "../../lib/useExitAnimation";
import { LogoMark } from "../Icons";
import { deleteToken, onOauthResult, startOauth } from "../../lib/secure";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../player/playerStore";
import type { ServiceId } from "../../types/music";
import { SERVICE_IDS } from "../../types/music";

const SERVICE_NAMES: Record<ServiceId, string> = {
  yandex: "Яндекс Музыка",
  vk: "VK Музыка",
};

/**
 * Оверлей настроек по макету «Настройки.png»: панель слева-снизу,
 * крупный заголовок, четыре раздела, круглая кнопка-крестик внизу,
 * фон за панелью размыт.
 */
export function SettingsOverlay() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const { mounted, closing } = useExitAnimation(settingsOpen);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50">
      {/* Размытие и затемнение фона */}
      <div
        className={`absolute inset-0 bg-black/45 backdrop-blur-xl ${
          closing ? "anim-exit-fade" : "animate-fade"
        }`}
        onClick={closeSettings}
      />

      <div
        className={`absolute bottom-6 left-8 flex h-[560px] w-[470px] flex-col rounded-modal bg-[#303030] px-10 pb-24 pt-10 shadow-2xl shadow-black/60 ${
          closing ? "anim-exit-pop" : "animate-modal"
        }`}
      >
        <Content />
      </div>
    </div>
  );
}

function Content() {
  const section = useUiStore((s) => s.settingsSection);
  switch (section) {
    case null:
      return <SettingsMenu />;
    case "integrations":
      return <IntegrationsPanel />;
    case "appearance":
      return <AppearancePanel />;
    case "player":
      return <PlayerPanel />;
    case "hotkeys":
      return <HotkeysPanel />;
    case "transitions":
      return <TransitionsPanel />;
  }
}

/** Корневое меню — в точности по макету «Настройки.png». */
function SettingsMenu() {
  const openSettings = useUiStore((s) => s.openSettings);
  return (
    <div className="flex h-full flex-col">
      <h1 className="text-center text-[38px] font-black tracking-tight">Настройки</h1>
      <nav className="mt-8 flex flex-col gap-6">
        <MenuButton label="Интеграции" onClick={() => openSettings("integrations")} />
        <MenuButton label="Внешний вид" onClick={() => openSettings("appearance")} />
        <MenuButton label="Плеер" onClick={() => openSettings("player")} />
        <MenuButton label="Горячие клавиши" onClick={() => openSettings("hotkeys")} />
        <MenuButton label="Плавные переходы" onClick={() => openSettings("transitions")} />
      </nav>
    </div>
  );
}

// --- Общие примитивы -----------------------------------------------------------

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left text-[19px] font-bold transition-transform duration-200 hover:translate-x-1"
    >
      {label}
    </button>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-[15px] font-bold">{label}</span>
        {hint && <span className="block text-[12px] font-semibold text-sub">{hint}</span>}
      </span>
      <button
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-inv" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full transition-all duration-200 ${
            checked ? "left-6 bg-[#1f1f1f]" : "left-1 bg-white/80"
          }`}
        />
      </button>
    </label>
  );
}

// --- Интеграции -----------------------------------------------------------------

function IntegrationsPanel() {
  const connections = useUiStore((s) => s.connections);
  const prefs = useUiStore((s) => s.prefs);
  const setPref = useUiStore((s) => s.setPref);
  const initConnections = useUiStore((s) => s.initConnections);
  const toast = useUiStore((s) => s.toast);
  const [busy, setBusy] = useState<ServiceId | null>(null);

  // Результат входа из окна-браузера (перехват на стороне Rust).
  // После успеха перечитываем подключения И библиотеку, чтобы треки
  // Яндекс/VK появились сразу, без перезапуска приложения.
  useEffect(
    () =>
      onOauthResult((r) => {
        toast(r.message);
        if (r.ok) {
          void (async () => {
            await initConnections();
            await useLibraryStore.getState().load();
          })();
        }
      }),
    [toast, initConnections]
  );

  const login = async (id: ServiceId) => {
    setBusy(id);
    try {
      await startOauth(id); // окно входа; токен перехватит Rust, не веб-слой
    } catch (e) {
      // Tauri отдаёт ошибку команды строкой — показываем её целиком,
      // чтобы была видна точная причина (например, «не настроен client_id»).
      const msg =
        typeof e === "string"
          ? e
          : e instanceof Error
            ? e.message
            : "Не удалось открыть вход";
      toast(msg);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (id: ServiceId) => {
    setBusy(id);
    try {
      await deleteToken(id);
      await initConnections();
      toast(`«${SERVICE_NAMES[id]}» отключён`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Интеграции">
      <div className="mb-4">
        <Switch
          checked={prefs.demoMode}
          onChange={(v) => setPref("demoMode", v)}
          label="Работа без аккаунта"
          hint="Локальный демо-каталог — включён по умолчанию"
        />
      </div>

      <div className="space-y-3">
        {SERVICE_IDS.map((id) => (
          <div key={id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
            <span className="flex items-center gap-2 text-[14px] font-bold">
              <span
                className={`h-2 w-2 rounded-full ${
                  connections[id] ? "bg-emerald-400" : "bg-white/25"
                }`}
              />
              {SERVICE_NAMES[id]}
            </span>
            {connections[id] ? (
              <button
                onClick={() => void disconnect(id)}
                disabled={busy === id}
                className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold transition-colors hover:bg-white/20"
              >
                Отключить
              </button>
            ) : (
              <button
                onClick={() => void login(id)}
                disabled={busy === id}
                className="rounded-full bg-inv px-3 py-1 text-[12px] font-bold text-[#1f1f1f] transition-transform enabled:hover:scale-105 disabled:opacity-40"
              >
                {busy === id ? "Открываю…" : "Войти"}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] font-semibold leading-relaxed text-white/45">
        Яндекс: откроется сайт Яндекс Музыки — войди как обычно, Manj перехватит
        сессию сайта и будет забирать твою музыку (лайки, волна) напрямую.
        VK: откроется страница авторизации; если VK пишет «слишком много
        попыток» — это его защита, подожди немного и попробуй снова.
      </p>
    </Panel>
  );
}

// --- Плеер -----------------------------------------------------------------------

function PlayerPanel() {
  const prefs = useUiStore((s) => s.prefs);
  const setPref = useUiStore((s) => s.setPref);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);

  return (
    <Panel title="Плеер">
      <div className="space-y-6">
        <label className="block">
          <span className="flex justify-between text-[14px] font-bold">
            <span>Громкость</span>
            <span className="tabular-nums">{Math.round(volume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="mt-3 w-full accent-white"
          />
        </label>

        <Switch
          checked={prefs.repeatQueue}
          onChange={(v) => setPref("repeatQueue", v)}
          label="Повторять очередь"
          hint="Когда волна закончилась — начинать сначала"
        />
        <Switch
          checked={prefs.autoPlay}
          onChange={(v) => setPref("autoPlay", v)}
          label="Автозапуск при старте"
          hint="Включать волну при открытии приложения"
        />
      </div>
    </Panel>
  );
}

// --- Внешний вид ------------------------------------------------------------------

function AppearancePanel() {
  const prefs = useUiStore((s) => s.prefs);
  const setPref = useUiStore((s) => s.setPref);
  return (
    <Panel title="Внешний вид">
      <div className="space-y-6">
        <div>
          <div className="mb-3 text-[15px] font-bold">Цвет логотипа</div>
          <div className="flex gap-3">
            {(Object.keys(LOGO_VARIANTS) as LogoId[]).map((id) => {
              const v = LOGO_VARIANTS[id];
              const active = prefs.logoId === id;
              return (
                <button
                  key={id}
                  onClick={() => setPref("logoId", id)}
                  className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 transition-all hover:scale-105 ${
                    active ? "bg-inv text-[#1f1f1f]" : "bg-white/10"
                  }`}
                  title={v.label}
                >
                  <LogoMark size={30} colors={v} />
                  <span className="text-[12px] font-bold">{v.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] font-semibold text-white/45">
            Логотип внизу левой панели (файлы Group-2 / Group-3 / Group-6)
          </div>
        </div>

        <Switch
          checked={prefs.compactSidebar}
          onChange={(v) => setPref("compactSidebar", v)}
          label="Компактный сайдбар"
          hint="Узкий рельс с иконками"
        />
        <Switch
          checked={prefs.animations}
          onChange={(v) => setPref("animations", v)}
          label="Микроанимации"
          hint="Отклик кнопок и переходы экранов"
        />
      </div>
    </Panel>
  );
}

// --- Горячие клавиши -----------------------------------------------------------------

const HOTKEYS: [string, string][] = [
  ["Space", "Пауза / воспроизведение"],
  ["→ / ←", "Перемотка ±5 секунд"],
  ["Ctrl + S", "Открыть интеграции"],
  ["Клик по обложке в плеере", "Очередь волны"],
];

function HotkeysPanel() {
  return (
    <Panel title="Горячие клавиши">
      <div className="space-y-3">
        {HOTKEYS.map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <kbd className="rounded-lg bg-black/30 px-3 py-1.5 text-[12px] font-bold">
              {key}
            </kbd>
            <span className="text-[14px] font-semibold text-sub">{desc}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// --- Плавные переходы -----------------------------------------------------------------

function TransitionsPanel() {
  const prefs = useUiStore((s) => s.prefs);
  const setPref = useUiStore((s) => s.setPref);

  return (
    <Panel title="Плавные переходы">
      <div className="space-y-6">
        <Switch
          checked={prefs.crossfade}
          onChange={(v) => setPref("crossfade", v)}
          label="Crossfade между треками"
          hint="Плавное затухание на стыке треков волны"
        />
        <label className="block">
          <span className="flex justify-between text-[14px] font-bold">
            <span>Длительность</span>
            <span className="tabular-nums">{prefs.crossfadeSec} c</span>
          </span>
          <input
            type="range"
            min={1}
            max={8}
            value={prefs.crossfadeSec}
            onChange={(e) => setPref("crossfadeSec", Number(e.target.value))}
            disabled={!prefs.crossfade}
            className="mt-3 w-full accent-white disabled:opacity-40"
          />
        </label>
      </div>
    </Panel>
  );
}

// --- Каркас раздела --------------------------------------------------------------------

function Panel({ title, children }: { title: string; children: ReactNode }) {
  const openSettings = useUiStore((s) => s.openSettings);
  return (
    <div className="flex h-full flex-col">
      <button
        onClick={() => openSettings(null)}
        className="mb-4 flex items-center gap-2 self-start text-[13px] font-bold text-white/60 transition-colors hover:text-white"
        title="К меню настроек"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        {title}
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}
