"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { appUrl } from "@/server/env";
import { run, type ActionResult } from "@/server/errors";
import { changeFatherPin, rotateFatherLink, setupFatherAccess } from "@/server/father";
import { str } from "@/server/parse";
import { requireOwner } from "@/server/session";

type LinkResult = ActionResult<{ link?: string }>;

export async function enableAccessAction(_p: LinkResult | undefined, fd: FormData): Promise<LinkResult> {
  await requireOwner();
  const result = await run<{ link?: string }>(async () => {
    const { token } = await setupFatherAccess(await getDb(), str(fd.get("pin")));
    return { link: `${appUrl()}/view/${token}` };
  });
  if (result.ok) revalidatePath("/more/father");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function rotateLinkAction(_p: LinkResult | undefined): Promise<LinkResult> {
  await requireOwner();
  const result = await run<{ link?: string }>(async () => {
    const { token } = await rotateFatherLink(await getDb());
    return { link: `${appUrl()}/view/${token}` };
  });
  if (result.ok) revalidatePath("/more/father");
  return result;
}

export async function changePinAction(_p: LinkResult | undefined, fd: FormData): Promise<LinkResult> {
  await requireOwner();
  return run<{ link?: string }>(async () => {
    await changeFatherPin(await getDb(), str(fd.get("pin")));
  });
}
