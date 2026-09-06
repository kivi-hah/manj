import type { AccentId } from "../types/music";
import { ART_BY_ACCENT } from "../lib/palette";
import { artFor } from "../services/mock/data";

/** Заглушки загрузки в стиле макета (серые пилюли/круги). */
export function PillSkeleton({ height = 100 }: { height?: number }) {
  return (
    <div
      className="animate-shimmer rounded-full bg-surface3"
      style={{ height }}
    />
  );
}

/** Круглая обложка: реальный URL → фирменный полосатый арт → градиент. */
export function ArtPlaceholder({
  src,
  accentId,
  seed,
  size = 76,
  className = "",
}: {
  src?: string;
  accentId?: AccentId;
  seed: string;
  size?: number;
  className?: string;
}) {
  const url = src ?? (accentId ? ART_BY_ACCENT[accentId] : artFor(seed));
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
