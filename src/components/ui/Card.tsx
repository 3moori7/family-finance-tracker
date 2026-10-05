import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(27,42,40,0.04)] ${className}`}
    />
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-medium text-ink-soft">{children}</h2>;
}
