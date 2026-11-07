// Cấu hình cố định cho stack Supabase tối giản chạy local (chỉ dùng cho dev/test).
import path from "node:path";

export const ROOT = path.resolve(__dirname, "../..");
export const STACK_DIR = path.join(ROOT, ".stack");
export const BIN_DIR = path.join(STACK_DIR, "bin");
export const RUN_DIR = path.join(STACK_DIR, "run");
export const LOG_DIR = path.join(STACK_DIR, "logs");

// Postgres chạy dưới user hệ điều hành `postgres` khi script chạy bằng root,
// nên thư mục dữ liệu phải nằm nơi user đó tạo được.
export const PG_DATA_DIR = "/tmp/wpb-pg";
export const PG_LOG_FILE = path.join(PG_DATA_DIR, "postgres.log");

export const PORTS = {
  gateway: 54321,
  postgres: 54322,
  auth: 9999,
  rest: 3001,
  restAdmin: 3002,
} as const;

export const HOST = "127.0.0.1";
export const PUBLIC_URL = `http://${HOST}:${PORTS.gateway}`;
export const SITE_URL = "http://127.0.0.1:3000";

// Giống giá trị mặc định của `supabase start` — chỉ an toàn cho máy local.
export const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
export const DB_PASSWORD = "postgres";

export function dbUrl(user: string, extra = ""): string {
  return `postgres://${user}:${DB_PASSWORD}@${HOST}:${PORTS.postgres}/postgres${extra}`;
}

export const RELEASES = {
  auth: {
    url: "https://github.com/supabase/auth/releases/download/v2.177.0/auth-v2.177.0-x86.tar.gz",
    dir: path.join(BIN_DIR, "auth-v2.177.0"),
    bin: "auth",
  },
  rest: {
    url: "https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz",
    dir: path.join(BIN_DIR, "postgrest-v12.2.3"),
    bin: "postgrest",
  },
} as const;
