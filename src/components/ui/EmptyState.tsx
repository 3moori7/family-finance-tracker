export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-medium text-ink-soft">{title}</p>
      {hint && <p className="text-sm text-ink-soft/80">{hint}</p>}
    </div>
  );
}
