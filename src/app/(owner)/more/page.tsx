import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { logout } from "@/app/login/actions";
import { requireOwner } from "@/server/session";

export default async function MorePage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const t = await getTranslations("more");
  const links = [
    { href: "/more/settings", label: t("settings") },
    { href: "/personal", label: t("personal") },
    { href: "/statements", label: t("statements") },
    { href: "/more/activity", label: t("activity") },
    { href: "/more/export", label: t("export") },
    { href: "/more/father", label: t("father") },
  ];
  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <Card className="divide-y divide-line p-0">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center justify-between px-4 font-medium">
            {l.label}
            <span className="text-ink-soft">›</span>
          </Link>
        ))}
      </Card>
      <form action={logout}>
        <button className="min-h-12 w-full rounded-xl border border-line bg-surface font-medium text-danger">
          {t("logout")}
        </button>
      </form>
    </>
  );
}
