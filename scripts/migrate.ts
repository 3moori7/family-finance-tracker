import { getDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";

async function main() {
  const db = await getDb();
  const ran = await runMigrations(db);
  console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date.");
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
