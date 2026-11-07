// npm run db:reset — tạo lại schema public, chạy migrations rồi seed (nếu có).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config";
import { readSql, withSuperuser } from "./postgres";

const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const SEED_FILE = path.join(ROOT, "supabase", "seed.sql");

async function main() {
  const migrations = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
    : [];

  await withSuperuser(async (db) => {
    await db.query("drop schema if exists public cascade");
    await db.query(readSql("public-schema.sql"));
    for (const file of migrations) {
      console.log(`[db] migration ${file}`);
      await db.query(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }
    if (existsSync(SEED_FILE)) {
      console.log("[db] seed.sql");
      await db.query(readFileSync(SEED_FILE, "utf8"));
    }
    await db.query("notify pgrst, 'reload schema'");
  });
  console.log(`[db] reset xong (${migrations.length} migration)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
