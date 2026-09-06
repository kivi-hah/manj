// ============================================================================
// Discovery Engine — пул «30% нового».
//
// Правило отбора: артист НЕ должен быть любимцем (низкая аффинность),
// но жанр должен быть релевантен вкусам — иначе это уже не открытие,
// а случайный шум. Дополнительно рандомизируем 30% оценки, чтобы
// очередь не вырождалась в одну и ту же «новинку недели».
// ============================================================================

import type { Track } from "../types/music";
import type { TasteProfile } from "./TasteProfile";

export function pickDiscovery(
  pool: Track[],
  profile: TasteProfile,
  k: number,
  exclude: Set<string>
): Track[] {
  // 1. Отбрасываем прослушанное/уже стоящее в очереди.
  // 2. Оставляем только «незнакомых» артистов: affinity < 0.35.
  // 3. Скоринг: жанровая близость * 0.7 + случайность * 0.3.
  const scored = pool
    .filter((t) => !exclude.has(t.id))
    .filter((t) => profile.artistAffinity(t.artist) < 0.35)
    .map((t) => ({
      track: t,
      score: profile.genreAffinity(t.genres) * 0.7 + Math.random() * 0.3,
    }))
    .sort((a, b) => b.score - a.score);

  // Не более одного трека на артиста внутри партии — разнообразие имён.
  const out: Track[] = [];
  const seenArtists = new Set<string>();
  for (const { track } of scored) {
    if (out.length >= k) break;
    if (seenArtists.has(track.artist)) continue;
    seenArtists.add(track.artist);
    out.push(track);
  }
  return out;
}
