export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s !== "change-me-in-production") return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-only-secret-not-for-production";
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
