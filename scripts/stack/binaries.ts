// Tải và giải nén GoTrue (Supabase Auth) và PostgREST vào .stack/bin ở lần chạy đầu.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RELEASES } from "./config";

type Release = (typeof RELEASES)[keyof typeof RELEASES];

async function ensureRelease(rel: Release): Promise<string> {
  const binPath = path.join(rel.dir, rel.bin);
  if (existsSync(binPath)) return binPath;

  console.log(`[stack] tải ${rel.url}`);
  const res = await fetch(rel.url);
  if (!res.ok) throw new Error(`Tải ${rel.url} thất bại: HTTP ${res.status}`);
  const archive = `${rel.dir}.download`;
  rmSync(rel.dir, { recursive: true, force: true });
  mkdirSync(rel.dir, { recursive: true });
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  try {
    execFileSync("tar", ["-xf", archive, "-C", rel.dir]);
  } finally {
    rmSync(archive, { force: true });
  }
  if (!existsSync(binPath)) throw new Error(`Không thấy ${binPath} sau khi giải nén`);
  return binPath;
}

export async function ensureBinaries() {
  return {
    auth: await ensureRelease(RELEASES.auth),
    rest: await ensureRelease(RELEASES.rest),
    authMigrations: path.join(RELEASES.auth.dir, "migrations"),
  };
}
