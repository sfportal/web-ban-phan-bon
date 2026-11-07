// npm run stack:start — khởi động Postgres, GoTrue, PostgREST và gateway rồi thoát.
import path from "node:path";
import { dbUrl, HOST, JWT_SECRET, PORTS, PUBLIC_URL, SITE_URL } from "./config";
import { ensureBinaries } from "./binaries";
import { writeEnvFiles } from "./env-file";
import { readSql, startPostgres, withSuperuser } from "./postgres";
import { startDetached, waitForHttp } from "./procs";

async function main() {
  const bins = await ensureBinaries();
  await startPostgres();
  await withSuperuser(async (db) => {
    await db.query(readSql("bootstrap.sql"));
    await db.query(readSql("public-schema.sql"));
  });

  startDetached("auth", bins.auth, [], {
    GOTRUE_API_HOST: HOST,
    PORT: String(PORTS.auth),
    API_EXTERNAL_URL: `${PUBLIC_URL}/auth/v1`,
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: dbUrl("supabase_auth_admin", "?search_path=auth"),
    GOTRUE_DB_MIGRATIONS_PATH: bins.authMigrations,
    GOTRUE_SITE_URL: SITE_URL,
    GOTRUE_URI_ALLOW_LIST: `${SITE_URL}/**`,
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
    GOTRUE_LOG_LEVEL: "info",
  });

  startDetached("rest", bins.rest, [], {
    PGRST_DB_URI: dbUrl("authenticator"),
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_HOST: HOST,
    PGRST_SERVER_PORT: String(PORTS.rest),
    PGRST_ADMIN_SERVER_PORT: String(PORTS.restAdmin),
  });

  startDetached(
    "gateway",
    process.execPath,
    ["--import", "tsx", path.join(__dirname, "gateway.ts")],
    {},
  );

  await waitForHttp("auth", `http://${HOST}:${PORTS.auth}/health`);
  await waitForHttp("rest", `http://${HOST}:${PORTS.restAdmin}/ready`);
  await waitForHttp("gateway", `${PUBLIC_URL}/auth/v1/health`);

  writeEnvFiles();
  console.log(`[stack] sẵn sàng: ${PUBLIC_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
