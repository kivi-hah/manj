import { useState } from "react";
import type { WaveTrack } from "../types/music";
import { usePlayerStore } from "../player/playerStore";
import { useUiStore } from "../stores/uiStore";
import { ArtPlaceholder } from "./Skeleton";

/**
 * Пилюля трека по макету: полосатая обложка слева + название.
 * Интерактив: клик — воспроизведение с этого места; hover — иконка Play
 * поверх обложки, лайк и «⋯» с меню («волна по треку», «к автору»);
 * клик по артисту — страница артиста.
 */
export function TrackPill({
  track,
  context,
  onLike,
  liked,
  showArtist = true,
}: {
  track: WaveTrack;
  context: WaveTrack[];
  onLike?: () => void;
  liked?: boolean;
  /** В сетке библиотеки по макету артист не показывается. */
  showArtist?: boolean;
}) {
  const playTrackFrom = usePlayerStore((s) => s.playTrackFrom);
  const playWaveFrom = usePlayerStore((s) => s.playWaveFrom);
  const openArtist = useUiStore((s) => s.openArtist);
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    {
      icon: "graphic_eq",
      label: "Волна по треку",
      onClick: () => {
        setMenuOpen(false);
        void playWaveFrom(track);
      },
    },
    {
      icon: "person",
      label: "К автору",
      onClick: () => {
        setMenuOpen(false);
        openArtist({
          serviceId: track.serviceId,
          artistId: track.artistId,
          name: track.artist,
        });
      },
    },
  ];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setMenuOpen(false);
      }}
      onClick={() => void playTrackFrom(track, context)}
      className="pill-hover relative flex h-[108px] cursor-pointer items-center gap-5 rounded-full bg-surface3 px-3 hover:bg-surface4"
      title={`Играть: ${track.artist} — ${track.title}`}
    >
      <div className="relative h-[84px] w-[96px] shrink-0">
        <ArtPlaceholder
          src={track.coverUrl}
          accentId={track.accentId}
          seed={track.id}
          size={84}
          className="!h-full !w-full"
        />
        {hover && !menuOpen && (
          <span className="material-symbols-outlined ms-fill absolute inset-0 flex items-center justify-center text-[34px] text-[#1f1f1f] drop-shadow">
            play_arrow
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pr-2">
        <div className="truncate text-[18px] font-bold leading-tight">{track.title}</div>
        {showArtist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openArtist({
                serviceId: track.serviceId,
                artistId: track.artistId,
                name: track.artist,
              });
            }}
            className="max-w-full truncate text-[12px] font-bold text-sub transition-colors hover:text-white"
            title={`Открыть страницу артиста: ${track.artist}`}
          >
            {track.artist}
          </button>
        )}
      </div>

      {onLike && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className={`shrink-0 transition-transform duration-150 hover:scale-110 ${
            liked ? "text-white" : "text-white/40 hover:text-white/80"
          }`}
          title={liked ? "Убрать лайк" : "Лайк"}
        >
          <span className={`material-symbols-outlined text-[22px] ${liked ? "ms-fill" : "ms-medium"}`}>
            thumb_up
          </span>
        </button>
      )}

      {/* «⋯»: волна по треку / к автору */}
      <div className="relative mr-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="text-white/50 transition-colors hover:text-white"
          title="Ещё"
        >
          <span className="material-symbols-outlined ms-medium text-[22px]">more_vert</span>
        </button>
        {menuOpen && (
          <div className="animate-pop absolute bottom-full right-0 z-50 mb-2 w-[190px] rounded-3xl bg-[#232323] p-1.5 shadow-2xl shadow-black/60">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/10"
              >
                <span className="material-symbols-outlined ms-medium text-[20px] text-white/85">
                  {item.icon}
                </span>
                <span className="text-[13px] font-bold">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


