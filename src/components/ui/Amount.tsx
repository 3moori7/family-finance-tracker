import { formatSar } from "@/lib/money";

/** Formatted SAR amount. Server- and client-safe. */
export function Amount({
  value,
  locale,
  className = "",
  signed,
}: {
  value: number;
  locale: "ar" | "en";
  className?: string;
  signed?: boolean;
}) {
  const text = formatSar(value, locale);
  return (
    <span className={`num ${className}`}>{signed && value > 0 ? `+${text}` : text}</span>
  );
}
