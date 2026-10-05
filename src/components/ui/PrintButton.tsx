"use client";

export function PrintButton({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="no-print flex flex-col gap-1">
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-ink"
      >
        {label}
      </button>
      <span className="text-xs text-ink-soft">{hint}</span>
    </div>
  );
}
