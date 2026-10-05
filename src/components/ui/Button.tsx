import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-primary hover:bg-primary-soft",
};

export function Button({
  variant = "primary",
  full,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
    />
  );
}
