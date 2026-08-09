"use client";

type ArrivalBannerProps = {
  placeName: string;
  onConfirm: () => void;
  onDismiss: () => void;
  disabled?: boolean;
};

export function ArrivalBanner({
  placeName,
  onConfirm,
  onDismiss,
  disabled = false,
}: ArrivalBannerProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-emerald-400/30 bg-emerald-950/50 px-4 py-4 shadow-lg"
    >
      <p className="text-base leading-snug text-emerald-50">
        Parece que llegaste a{" "}
        <span className="font-semibold text-white">{placeName}</span> — ¿Marcar como hecho?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onConfirm}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          Sí, marcar hecho
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDismiss}
          className="rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 disabled:opacity-60"
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
