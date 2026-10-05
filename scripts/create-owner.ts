import readline from "node:readline/promises";
import { getDb } from "../src/db/client";
import { upsertOwner } from "../src/server/owner";

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = process.env.OWNER_EMAIL || (await rl.question("Owner email: "));
  const password = process.env.OWNER_PASSWORD || (await rl.question("Owner password (min 10 chars): "));
  rl.close();
  if (password.length < 10) throw new Error("Password must be at least 10 characters");
  const db = await getDb();
  await upsertOwner(db, email, password);
  console.log(`Owner account saved for ${email}.`);
  await db.close();
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
