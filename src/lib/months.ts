/** Month helpers. A month key is "YYYY-MM". "Today" always means today in Saudi Arabia. */
export const APP_TIMEZONE = "Asia/Riyadh";

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(now);
}

export function monthKeyOf(date: Date | string): string {
  if (typeof date === "string") return date.slice(0, 7);
  return todayISO(date).slice(0, 7);
}

export function isMonthKey(v: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
