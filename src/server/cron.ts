import { safeEqual } from "@/lib/security";

/** Cron endpoints require `Authorization: Bearer $CRON_SECRET` (Vercel sends it automatically). */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") return false;
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
