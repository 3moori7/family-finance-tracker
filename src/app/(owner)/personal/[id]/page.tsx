import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { EditExpense } from "@/components/expenses/EditExpense";
import { toInputString } from "@/lib/money";
import { todayISO } from "@/lib/months";
import { getPersonalExpense } from "@/server/personal";
import { deletePersonalAction, updatePersonalAction } from "../actions";
import { requireOwner } from "@/server/session";

export default async function EditPersonalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const e = await getPersonalExpense(await getDb(), n);
  if (!e) notFound();
  const t = await getTranslations("personal");
  return (
    <>
      <h1 className="text-xl font-bold">{t("edit")}</h1>
      <EditExpense
        defaults={{ id: e.id, amount: toInputString(e.amount), category: e.category, date: e.date, note: e.note ?? "" }}
        maxDate={todayISO()}
        backHref={`/personal?m=${e.date.slice(0, 7)}`}
        updateAction={updatePersonalAction}
        deleteAction={deletePersonalAction}
      />
    </>
  );
}
