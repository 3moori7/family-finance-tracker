import { getDb } from "@/db/client";
import { runBackupJob } from "@/server/backup-job";
import { authorizeCron } from "@/server/cron";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runBackupJob(await getDb());
  return Response.json(result);
}
