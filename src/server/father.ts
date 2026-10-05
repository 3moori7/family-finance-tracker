import type { Db } from "@/db/types";
import type { Category } from "@/lib/categories";
import { hashSecret, randomToken, safeEqual, sha256, verifySecret } from "@/lib/security";
import { AppError } from "./errors";
import { countStatus, latestCount, type CountStatus } from "./cashcount";
import { monthClaim } from "./expenses";
import { getBalance } from "./ledger";
import { currentMonthKey, findMonth, neighbours } from "./months";
import { clearFailures, isLocked, recordFailure } from "./rate-limit";

const PIN_RE = /^\d{4,8}$/;

function assertPin(pin: string) {
  if (!PIN_RE.test(pin)) throw new AppError("pinInvalid", "pin");
}

/** Sets the PIN and creates a brand new private link. Returns the raw token (shown once). */
export async function setupFatherAccess(db: Db, pin: string): Promise<{ token: string }> {
  assertPin(pin);
  const token = randomToken();
  await db.query(
    `update settings set pin_hash=$1, view_token_hash=$2, view_token_version=view_token_version+1,
       updated_at=now() where id=1`,
    [hashSecret(pin), sha256(token)],
  );
  return { token };
}

/** New link, same PIN. The old link and every father session stop working immediately. */
export async function rotateFatherLink(db: Db): Promise<{ token: string }> {
  const token = randomToken();
  const rows = await db.query(
    `update settings set view_token_hash=$1, view_token_version=view_token_version+1, updated_at=now()
     where id=1 and pin_hash is not null returning id`,
    [sha256(token)],
  );
  if (rows.length === 0) throw new AppError("notFound");
  return { token };
}

/** New PIN, same link. Existing father sessions are signed out. */
export async function changeFatherPin(db: Db, pin: string): Promise<void> {
  assertPin(pin);
  const rows = await db.query(
    `update settings set pin_hash=$1, view_token_version=view_token_version+1, updated_at=now()
     where id=1 and view_token_hash is not null returning id`,
    [hashSecret(pin)],
  );
  if (rows.length === 0) throw new AppError("notFound");
}

export async function fatherAccessStatus(db: Db): Promise<{ configured: boolean }> {
  const [r] = await db.query<{ ok: boolean }>(
    "select (pin_hash is not null and view_token_hash is not null) as ok from settings where id = 1",
  );
  return { configured: !!r?.ok };
}

/** Checks the link token without leaking whether a link exists. */
export async function verifyViewToken(db: Db, token: string): Promise<{ version: number } | null> {
  const [r] = await db.query<{ view_token_hash: string | null; view_token_version: number }>(
    "select view_token_hash, view_token_version from settings where id = 1",
  );
  if (!r?.view_token_hash || !token) return null;
  return safeEqual(sha256(token), r.view_token_hash) ? { version: r.view_token_version } : null;
}

export type PinResult = { ok: true; version: number } | { ok: false; reason: "locked" | "invalid" };

export async function checkPin(db: Db, token: string, pin: string, ipScope: string): Promise<PinResult> {
  const link = await verifyViewToken(db, token);
  if (!link) return { ok: false, reason: "invalid" };
  if ((await isLocked(db, "pin:all", 10)) || (await isLocked(db, ipScope))) return { ok: false, reason: "locked" };
  const [r] = await db.query<{ pin_hash: string | null }>("select pin_hash from settings where id = 1");
  if (!PIN_RE.test(pin) || !verifySecret(pin, r?.pin_hash)) {
    await recordFailure(db, ipScope);
    await recordFailure(db, "pin:all");
    return { ok: false, reason: "invalid" };
  }
  await clearFailures(db, ipScope);
  return { ok: true, version: link.version };
}

/** True when the session's link version still matches (rotation signs everyone out). */
export async function sessionStillValid(db: Db, version: number | undefined): Promise<boolean> {
  const [r] = await db.query<{ v: number }>("select view_token_version as v from settings where id = 1");
  return !!r && version === r.v;
}

/**
 * Everything the father may see. Deliberately has no itemised expenses and nothing from the
 * personal tracker; add fields here only after deciding they are meant for him.
 */
export interface FatherView {
  monthKey: string;
  monthStatus: "open" | "closed";
  prevKey: string | null;
  nextKey: string | null;
  balance: number;
  claimTotal: number;
  claimCount: number;
  breakdown: { category: Category; total: number }[];
  reimbursed: boolean;
  cashCount: CountStatus;
  sadaqahGiven: boolean;
}

export async function getFatherView(db: Db, monthKey?: string): Promise<FatherView> {
  const key = monthKey ?? (await currentMonthKey(db));
  const month = await findMonth(db, key);
  const balance = await getBalance(db);
  const { prevKey, nextKey } = await neighbours(db, key);
  const claim = month ? await monthClaim(db, month.id) : { total: 0, count: 0, breakdown: [] };
  const last = month ? await latestCount(db, month.id) : null;
  return {
    monthKey: key,
    monthStatus: month?.status ?? "open",
    prevKey,
    nextKey,
    balance,
    claimTotal: claim.total,
    claimCount: claim.count,
    breakdown: claim.breakdown as { category: Category; total: number }[],
    reimbursed: month?.reimbursed ?? false,
    cashCount: countStatus(last, balance),
    sadaqahGiven: month?.sadaqahGiven ?? false,
  };
}
