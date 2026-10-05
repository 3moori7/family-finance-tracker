import { Amount } from "@/components/ui/Amount";

export function StatementRow({
  label,
  value,
  locale,
  bold,
}: {
  label: string;
  value: number;
  locale: "ar" | "en";
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-semibold" : "text-ink-soft"}`}>
      <span>{label}</span>
      <Amount value={value} locale={locale} />
    </div>
  );
}

export function StatementSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
