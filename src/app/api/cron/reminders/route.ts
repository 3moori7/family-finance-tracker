import { getDb } from "@/db/client";
import { authorizeCron } from "@/server/cron";
import { runReminders } from "@/server/reminders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runReminders(await getDb()));
}
