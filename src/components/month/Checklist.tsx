import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import type { Checklist } from "@/server/checklist";

export async function ChecklistCard({ list, closed }: { list: Checklist; closed: boolean }) {
  const t = await getTranslations("checklist");
  const done = list.steps.filter((s) => s.done).length;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("title")}</h2>
        <span className="num text-sm text-ink-soft">
          {done}/{list.steps.length}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {list.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-xs ${
                s.done || closed ? "bg-ok text-white" : "border border-line text-transparent"
              }`}
              aria-hidden
            >
              ✓
            </span>
            <span className={s.done || closed ? "text-ink" : "text-ink-soft"}>{t(s.key)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
