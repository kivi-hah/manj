// ============================================================================
// Анимация выхода: пока `open`=false, компонент остаётся смонтированным
// на короткое время — чтобы проигралась анимация исчезновения.
//
// Использование:
//   const { mounted, closing } = useExitAnimation(settingsOpen);
//   if (!mounted) return null;
//   <div className={closing ? "anim-exit-pop ..." : "animate-pop ..."}>…
// ============================================================================

import { useEffect, useState } from "react";

export function useExitAnimation(open: boolean, duration = 220) {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    if (!rendered) return; // уже скрыто
    const timer = setTimeout(() => setRendered(false), duration);
    return () => clearTimeout(timer);
  }, [open, rendered, duration]);

  return { mounted: rendered, closing: rendered && !open };
}
