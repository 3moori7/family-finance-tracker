"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const icons: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  expenses: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  savings: "M12 3C7.5 3 4 4.4 4 6.5S7.5 10 12 10s8-1.4 8-3.5S16.5 3 12 3zM4 6.5v5C4 13.6 7.5 15 12 15s8-1.4 8-3.5v-5M4 11.5v5c0 2.1 3.5 3.5 8 3.5s8-1.4 8-3.5v-5",
  month: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

const items = [
  { key: "home", href: "/" },
  { key: "expenses", href: "/expenses" },
  { key: "savings", href: "/savings" },
  { key: "month", href: "/month" },
  { key: "more", href: "/more" },
] as const;

export function BottomNav() {
  const path = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {items.map(({ key, href }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  active ? "text-primary" : "text-ink-soft"
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={icons[key]} />
                </svg>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
