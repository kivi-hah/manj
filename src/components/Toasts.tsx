import { useUiStore } from "../stores/uiStore";

/** Всплывающие сообщения об ошибках/событиях (состояния ошибок интерфейса). */
export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div className="fixed right-5 top-16 z-[60] flex w-[360px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="animate-modal cursor-pointer rounded-2xl bg-[#3a2a2a]/95 px-4 py-3 text-[13px] font-semibold text-white shadow-xl shadow-black/50 backdrop-blur"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
