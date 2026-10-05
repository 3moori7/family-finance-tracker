// Fails when anything secret-looking ended up in the JavaScript sent to browsers.
// Run after `next build`.
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), ".next", "static");
if (!fs.existsSync(root)) {
  console.error("Run `npm run build` first (.next/static is missing).");
  process.exit(1);
}
const forbidden = [
  "SESSION_SECRET", "RESEND_API_KEY", "CRON_SECRET", "DATABASE_URL", "OWNER_PASSWORD",
  "owner_password_hash", "view_token_hash", "pin_hash", "scrypt$", "dev-only-secret-not-for-production",
];
const secretValues = ["SESSION_SECRET", "RESEND_API_KEY", "CRON_SECRET", "DATABASE_URL", "OWNER_PASSWORD"]
  .map((k) => process.env[k])
  .filter((v) => v && v.length >= 8);

let bad = 0;
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(js|css|html|json|map)$/.test(f.name)) {
      const text = fs.readFileSync(p, "utf8");
      for (const needle of [...forbidden, ...secretValues]) {
        if (text.includes(needle)) {
          console.error(`LEAK: "${needle.length > 12 ? needle.slice(0, 4) + "…" : needle}" found in ${path.relative(process.cwd(), p)}`);
          bad++;
        }
      }
    }
  }
};
walk(root);
if (bad) process.exit(1);
console.log("OK: no secrets found in the browser bundle.");
