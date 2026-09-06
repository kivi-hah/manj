// ============================================================================
// AudioEngine — потоковое воспроизведение в WebView.
//
// Выбор архитектуры: воспроизводим через <audio> элемент WebView, а не через
// rodio на стороне Rust, потому что:
//  — HTML5 Audio + hls.js закрывают и MP3, и HLS/M3U8 (MSE) без прокачки
//    PCM через IPC;
//  — токи UI (позиция, seek, громкость) не требуют IPC-трафика;
//  — синхронизация волны (preload следующего трека) делается в JS.
// Rust при этом остаётся гарантом безопасности: подписанные/авторизованные
// URL раздаются через схему stream:// (см. src-tauri/src/stream_proxy.rs).
//
// Пример инициализации и связки с плеером — в playerStore.initPlayer().
// ============================================================================

import type { StreamInfo } from "../types/music";

type Listener<T> = (value: T) => void;

export class AudioEngine {
  private el: HTMLAudioElement;
  private hls: any | null = null; // hls.js подгружается динамически
  private preloader: HTMLAudioElement | null = null;
  private nearEndFired = false;

  // Колбэки навешивает playerStore — движок не знает про UI.
  onTime: Listener<number> = () => {};
  onLoaded: Listener<number> = () => {};
  onEnded: Listener<null> = () => {};
  onError: Listener<string> = () => {};
  /** Сработает за ~2 секунды до конца — окно для preload/crossfade. */
  onNearEnd: Listener<null> = () => {};

  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";

    this.el.addEventListener("timeupdate", () => {
      this.onTime(this.el.currentTime);
      this.checkNearEnd();
    });
    this.el.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(this.el.duration)) this.onLoaded(this.el.duration);
    });
    this.el.addEventListener("ended", () => this.onEnded(null));
    this.el.addEventListener("error", () => {
      const code = this.el.error?.code;
      this.onError(describeMediaError(code));
    });
  }

  // --- Загрузка и воспроизведение ------------------------------------------------

  /**
   * Загрузить поток и (по умолчанию) начать воспроизведение.
   * mp3/blob → прямой src; hls → hls.js через MSE, а в Safari — нативно.
   */
  async load(stream: StreamInfo, autoplay = true): Promise<void> {
    this.detachHls();
    this.nearEndFired = false;

    if (stream.kind === "drm") {
      throw new Error(
        "Этот сервис шифрует поток (DRM) — воспроизведение будет добавлено через Web Playback SDK"
      );
    }

    if (stream.kind === "hls" && !this.el.canPlayType("application/vnd.apple.mpegurl")) {
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) {
        throw new Error("HLS не поддерживается этой сборкой WebView");
      }
      this.hls = new Hls({ maxBufferLength: 30, enableWorker: true });
      this.hls.on(Hls.Events.ERROR, (_e: unknown, data: any) => {
        if (data?.fatal) this.onError(`Ошибка HLS-потока: ${data.details ?? "unknown"}`);
      });
      this.hls.loadSource(stream.url);
      this.hls.attachMedia(this.el);
    } else {
      this.el.src = stream.url;
    }

    if (autoplay) {
      // Жест пользователя уже был (клик по Play), поэтому autoplay разрешён.
      await this.el.play().catch((e: DOMException) => {
        throw new Error(`Не удалось начать воспроизведение: ${e.message}`);
      });
    }
  }

  play(): void {
    void this.el.play().catch((e: DOMException) =>
      this.onError(`Не удалось возобновить воспроизведение: ${e.message}`)
    );
  }

  pause(): void {
    this.el.pause();
  }

  seek(sec: number): void {
    if (Number.isFinite(this.el.duration)) {
      this.el.currentTime = Math.min(Math.max(sec, 0), this.el.duration);
    }
  }

  setVolume(v: number): void {
    this.el.volume = Math.min(Math.max(v, 0), 1);
  }

  get currentTime(): number {
    return this.el.currentTime;
  }

  // --- Предзагрузка («на лету», для бесконечной волны) ------------------------------

  /**
   * Предзагрузка следующего трека: для mp3 создаем невидимый Audio с
   * preload=auto — браузер положит начало файла в кэш и переключение
   * почти мгновенно. Для HLS это неэффективно (сегменты не переиспользуются
   * между инстансами) — здесь win: переключение всё равно < ~1 c.
   */
  preload(stream: StreamInfo): void {
    if (stream.kind !== "mp3") return;
    this.preloader?.remove();
    const a = new Audio();
    a.preload = "auto";
    a.src = stream.url;
    this.preloader = a;
  }

  dispose(): void {
    this.detachHls();
    this.preloader?.remove();
    this.el.pause();
    this.el.src = "";
  }

  // --- Внутреннее -----------------------------------------------------------------

  private checkNearEnd(): void {
    const d = this.el.duration;
    if (!this.nearEndFired && Number.isFinite(d) && d > 0 && d - this.el.currentTime <= 2) {
      this.nearEndFired = true;
      this.onNearEnd(null);
    }
  }

  private detachHls(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }
}

function describeMediaError(code?: number): string {
  switch (code) {
    case MediaError.MEDIA_ERR_NETWORK:
      return "Сетевая ошибка при воспроизведении";
    case MediaError.MEDIA_ERR_DECODE:
      return "Не удалось декодировать аудиопоток";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "Формат потока не поддерживается";
    default:
      return "Ошибка воспроизведения";
  }
}
