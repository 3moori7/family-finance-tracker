"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { checkPin } from "@/server/father";
import { clientIp } from "@/server/client-ip";
import { endFatherSession, startFatherSession } from "@/server/session";

export type PinState = { error?: "invalid" | "locked" };

export async function submitPin(token: string, _prev: PinState, fd: FormData): Promise<PinState> {
  const pin = String(fd.get("pin") ?? "").trim();
  const result = await checkPin(await getDb(), token, pin, `pin:ip:${await clientIp()}`);
  if (!result.ok) return { error: result.reason };
  await startFatherSession(result.version);
  redirect(`/view/${token}`);
}

export async function exitView(token: string) {
  await endFatherSession();
  redirect(`/view/${token}`);
}
