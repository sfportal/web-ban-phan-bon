// Ghi/cập nhật biến Supabase vào .env.local và .env.test, giữ nguyên các dòng khác.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_URL, ROOT } from "./config";
import { ANON_KEY, SERVICE_ROLE_KEY } from "./jwt";

const VARS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: PUBLIC_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
};

export function upsertEnv(content: string, vars: Record<string, string>): string {
  const lines = content === "" ? [] : content.replace(/\n$/, "").split("\n");
  const pending = new Map(Object.entries(vars));
  const out = lines.map((line) => {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (key && pending.has(key)) {
      const value = pending.get(key)!;
      pending.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  for (const [key, value] of pending) out.push(`${key}=${value}`);
  return `${out.join("\n")}\n`;
}

export function writeEnvFiles(): void {
  for (const name of [".env.local", ".env.test"]) {
    const file = path.join(ROOT, name);
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    writeFileSync(file, upsertEnv(current, VARS));
    console.log(`[stack] cập nhật ${name}`);
  }
}
