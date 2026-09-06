// ============================================================================
// Палитра плеера из обложки.
//
// Если у трека есть фирменный accentId (полосатые арты) — сначала точные
// цвета макета. Для настоящих обложек акцент вытягивается из самого
// изображения: пиксели квантуются по корзинам, берётся ДОМИНИРУЮЩИЙ
// насыщенный цвет (не средний — иначе цвета «грязнятся»), слегка
// усиливается по HSL и превращается в пару «тёмный фон + акцент».
// Обложки без CORS-заголовков безопасно падают в нейтральную палитру.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import type { Track } from "../types/music";
import { getPalette, darken, gradientOf, neutralPalette, type PlayerPalette } from "./palette";
import { ART_BY_ACCENT } from "./palette";
import { artFor } from "../services/mock/data";
import { useUiStore } from "../stores/uiStore";

const cache = new Map<string, PlayerPalette | null>();
const pending = new Map<string, Promise<PlayerPalette | null>>();

// --- Цветовые хелперы -----------------------------------------------------------

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) =>
    Math.round(Math.min(255, Math.max(0, x)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// --- Извлечение доминирующего цвета ------------------------------------------------

export function extractPalette(coverUrl: string): Promise<PlayerPalette | null> {
  const cached = cache.get(coverUrl);
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = pending.get(coverUrl);
  if (inflight) return inflight;

  const p = new Promise<PlayerPalette | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Квантование по корзинам 4 бита на канал; серые/чёрные/белые — мимо.
        const buckets = new Map<
          number,
          { r: number; g: number; b: number; n: number }
        >();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (data[i + 3] < 128) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          // отсекаем ахроматические и вырожденные пиксели
          if (max - min < 28 && (max < 70 || min > 190)) continue;
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
          cur.r += r;
          cur.g += g;
          cur.b += b;
          cur.n += 1;
          buckets.set(key, cur);
        }
        if (!buckets.size) return resolve(null);

        // Два доминирующих ОТЛИЧАЮЩИХСЯ цвета (hue ≥ 25° между ними):
        // первый — акцент, второй — второй цвет градиента фона.
        const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
        const rgbOf = (v: { r: number; g: number; b: number; n: number }) => [
          v.r / v.n,
          v.g / v.n,
          v.b / v.n,
        ];
        const c1 = rgbOf(sorted[0]);
        let c2 = c1;
        for (const cand of sorted.slice(1)) {
          const rgb = rgbOf(cand);
          const [h1] = rgbToHsl(c1[0], c1[1], c1[2]);
          const [h2] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
          const dh = Math.abs(h1 - h2);
          const dist = Math.min(dh, 1 - dh);
          if (dist > 0.07) {
            c2 = rgb;
            break;
          }
        }

        const boost = (rgb: number[], lMin: number, lMax: number) => {
          const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
          const [rr, gg, bb] = hslToRgb(h, Math.min(0.62, Math.max(0.35, s * 1.25)), Math.min(lMax, Math.max(lMin, l)));
          return rgbToHex(rr, gg, bb);
        };

        const accent = boost(c1, 0.5, 0.64); // акцент из первого цвета
        // Фон фуллскрина — ЧУТЬ ТЕМНЕЕ цветов обложки
        const fsC1 = boost(c1, 0.46, 0.56);
        const fsC2 = boost(c2, 0.34, 0.46);

        const palette: PlayerPalette = {
          accent,
          bg: darken(accent, 0.8),
          controls: darken(accent, 0.72),
          fsBg: gradientOf(fsC1, fsC2),
        };
        cache.set(coverUrl, palette);
        resolve(palette);
      } catch {
        // tainted canvas (CDN без CORS) — нейтральная палитра
        cache.set(coverUrl, null);
        resolve(null);
      }
    };
    img.onerror = () => {
      cache.set(coverUrl, null);
      resolve(null);
    };
    img.src = coverUrl;
  });

  pending.set(coverUrl, p);
  void p.finally(() => pending.delete(coverUrl));
  return p;
}

// --- Хук палитры для плеера -----------------------------------------------------------

/** Обложка трека в виде URL (реальная или фирменный полосатый арт). */
export function coverOf(track: Track | null): string | undefined {
  if (!track) return undefined;
  return (
    track.coverUrl ??
    (track.accentId ? ART_BY_ACCENT[track.accentId] : undefined) ??
    artFor(track.id)
  );
}

/**
 * Палитра для трека. Полосатые арты (accentId) — мгновенно из макета;
 * настоящие обложки — экстракцией (пока не готова — нейтральная).
 * Нейтральная палитра СЛЕДУЕТ цвету логотипа (Внешний вид),
 * чёрный фон окна при этом не трогается.
 */
export function usePlayerPalette(track: Track | null): PlayerPalette {
  const logoId = useUiStore((s) => s.prefs.logoId);
  const neutral = useMemo(() => neutralPalette(logoId), [logoId]);
  const [extracted, setExtracted] = useState<PlayerPalette | null>(null);

  const url = coverOf(track);

  useEffect(() => {
    if (track?.accentId || !url) {
      setExtracted(null);
      return;
    }
    let alive = true;
    void extractPalette(url).then((palette) => {
      if (alive) setExtracted(palette);
    });
    return () => {
      alive = false;
    };
  }, [url, track?.accentId]);

  if (track?.accentId) return getPalette(track.accentId);
  return extracted ?? neutral;
}
