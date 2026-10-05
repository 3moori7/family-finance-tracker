import fs from "node:fs";
import { getDb } from "../src/db/client";
import { restoreAll, type Dump } from "../src/server/backup";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run restore -- path/to/family-tracker-YYYY-MM-DD.json");
  const dump = JSON.parse(fs.readFileSync(file, "utf8")) as Dump;
  const db = await getDb(); // migrates an embedded database automatically
  await restoreAll(db, dump);
  console.log("Restored. Now run `npm run create-owner` to set the owner password and re-enable Dad's access in the app.");
  await db.close();
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
