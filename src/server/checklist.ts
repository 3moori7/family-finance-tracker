import type { Db } from "@/db/types";
import { AppError } from "./errors";
import { countStatus, latestCount, type CountStatus } from "./cashcount";
import { monthClaim } from "./expenses";
import { getBalance, hasDeposit } from "./ledger";
import { mustFindMonth, type Month } from "./months";

export type StepKey = "salary" | "deposit" | "sadaqah" | "reimbursed" | "cashcount";

export interface Checklist {
  steps: { key: StepKey; done: boolean }[];
  canClose: boolean;
  countStatus: CountStatus;
  claimTotal: number;
  claimCount: number;
  deposited: boolean;
}

export async function buildChecklist(db: Db, month: Month): Promise<Checklist> {
  const [deposited, claim, balance, last] = await Promise.all([
    hasDeposit(db, month.id),
    monthClaim(db, month.id),
    getBalance(db),
    latestCount(db, month.id),
  ]);
  const status = countStatus(last, balance);
  const steps: Checklist["steps"] = [
    { key: "salary", done: !!month.salaryConfirmedAt },
    { key: "deposit", done: deposited },
    { key: "sadaqah", done: month.sadaqahGiven },
    // nothing to claim means nothing to reimburse
    { key: "reimbursed", done: month.reimbursed || claim.count === 0 },
    { key: "cashcount", done: status === "match" || status === "accepted" },
  ];
  return {
    steps,
    canClose: month.status === "open" && steps.every((s) => s.done),
    countStatus: status,
    claimTotal: claim.total,
    claimCount: claim.count,
    deposited,
  };
}

/** Step 6: close and lock the month (the database re-checks every rule). */
export async function closeMonth(db: Db, key: string): Promise<void> {
  const month = await mustFindMonth(db, key);
  if (month.status === "closed") throw new AppError("alreadyDone");
  const list = await buildChecklist(db, month);
  if (!list.canClose) throw new AppError("close_incomplete");
  await db.query("update months set status='closed' where id=$1", [month.id]);
}
