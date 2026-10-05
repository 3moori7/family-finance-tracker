import { getDb } from "@/db/client";
import { todayISO } from "@/lib/months";
import { buildWorkbook, dumpAll } from "@/server/backup";
import { isOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isOwner())) return new Response("Unauthorized", { status: 401 });
  const dump = await dumpAll(await getDb());
  const day = todayISO();
  const headers = { "Cache-Control": "no-store" };
  if (new URL(request.url).searchParams.get("format") === "json") {
    return new Response(JSON.stringify(dump), {
      headers: { ...headers, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="family-tracker-${day}.json"` },
    });
  }
  const buf = await buildWorkbook(dump);
  return new Response(new Uint8Array(buf), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="family-tracker-${day}.xlsx"`,
    },
  });
}
