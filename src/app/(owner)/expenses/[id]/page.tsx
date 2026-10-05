import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { EditExpense } from "@/components/expenses/EditExpense";
import { toInputString } from "@/lib/money";
import { todayISO } from "@/lib/months";
import { getFamilyExpense } from "@/server/expenses";
import { findMonth } from "@/server/months";
import { deleteExpenseAction, updateExpenseAction } from "../actions";
import { requireOwner } from "@/server/session";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const db = await getDb();
  const e = await getFamilyExpense(db, n);
  if (!e) notFound();
  const month = await findMonth(db, e.monthKey);
  const t = await getTranslations("expenses");
  const locked = month?.status === "closed" || month?.reimbursed;
  return (
    <>
      <h1 className="text-xl font-bold">{t("edit")}</h1>
      {locked ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">{t("lockedReimbursed")}</p>
      ) : (
        <EditExpense
          defaults={{ id: e.id, amount: toInputString(e.amount), category: e.category, date: e.date, note: e.note ?? "" }}
          maxDate={todayISO()}
          backHref={`/expenses?m=${e.monthKey}`}
          updateAction={updateExpenseAction}
          deleteAction={deleteExpenseAction}
        />
      )}
    </>
  );
}
