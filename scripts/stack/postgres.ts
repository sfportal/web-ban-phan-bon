// Postgres từ embedded-postgres: initdb một lần, chạy nền bằng pg_ctl (dữ liệu giữ lại).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { DB_PASSWORD, dbUrl, HOST, PG_DATA_DIR, PG_LOG_FILE, PORTS } from "./config";

async function pgCtlPath(): Promise<string> {
  const mod = await import(`@embedded-postgres/${os.platform()}-${os.arch()}`);
  return mod.pg_ctl as string;
}

// initdb/postgres không chạy được dưới root: dùng user `postgres` của hệ điều hành.
function runAs(): { uid?: number; gid?: number } {
  if (os.userInfo().uid !== 0) return {};
  const id = (flag: string) => Number(execFileSync("id", [flag, "postgres"]).toString().trim());
  return { uid: id("-u"), gid: id("-g") };
}

function pgCtl(bin: string, args: string[]) {
  return spawnSync(bin, ["-D", PG_DATA_DIR, ...args], { ...runAs(), encoding: "utf8" });
}

export async function startPostgres(): Promise<void> {
  if (!existsSync(path.join(PG_DATA_DIR, "PG_VERSION"))) {
    console.log(`[stack] initdb ${PG_DATA_DIR}`);
    await new EmbeddedPostgres({
      databaseDir: PG_DATA_DIR,
      port: PORTS.postgres,
      user: "postgres",
      password: DB_PASSWORD,
      authMethod: "scram-sha-256",
      onLog: () => {},
    }).initialise();
  }
  const bin = await pgCtlPath();
  if (pgCtl(bin, ["status"]).status === 0) {
    console.log("[stack] postgres đang chạy");
    return;
  }
  const opts = `-p ${PORTS.postgres} -c listen_addresses=${HOST} -k /tmp`;
  const res = pgCtl(bin, ["-l", PG_LOG_FILE, "-o", opts, "-w", "start"]);
  if (res.status !== 0) {
    const log = existsSync(PG_LOG_FILE) ? readFileSync(PG_LOG_FILE, "utf8").slice(-2000) : "";
    throw new Error(`pg_ctl start thất bại:\n${res.stdout}${res.stderr}\n${log}`);
  }
  console.log(`[stack] postgres sẵn sàng tại ${HOST}:${PORTS.postgres}`);
}

export async function stopPostgres(): Promise<void> {
  if (!existsSync(path.join(PG_DATA_DIR, "PG_VERSION"))) return;
  const bin = await pgCtlPath();
  if (pgCtl(bin, ["status"]).status !== 0) return;
  const res = pgCtl(bin, ["-m", "fast", "-w", "stop"]);
  if (res.status !== 0) throw new Error(`pg_ctl stop thất bại:\n${res.stdout}${res.stderr}`);
  console.log("[stack] đã dừng postgres");
}

export async function withSuperuser<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: dbUrl("postgres") });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export function readSql(name: string): string {
  return readFileSync(path.join(__dirname, name), "utf8");
}
