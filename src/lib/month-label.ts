const AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-03" -> "مارس 2026" / "March 2026" (Western digits for the year). */
export function monthLabel(key: string, locale: "ar" | "en"): string {
  const [y, m] = key.split("-").map(Number);
  return `${(locale === "ar" ? AR : EN)[m - 1]} ${y}`;
}
