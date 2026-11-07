// Chạy tiến trình nền (detached) có pid file, dừng và chờ healthcheck.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LOG_DIR, RUN_DIR } from "./config";

const pidFile = (name: string) => path.join(RUN_DIR, `${name}.pid`);

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function runningPid(name: string): number | null {
  if (!existsSync(pidFile(name))) return null;
  const pid = Number(readFileSync(pidFile(name), "utf8"));
  return pid > 0 && isAlive(pid) ? pid : null;
}

export function startDetached(
  name: string,
  cmd: string,
  args: string[],
  env: Record<string, string>,
): void {
  if (runningPid(name)) {
    console.log(`[stack] ${name} đang chạy`);
    return;
  }
  mkdirSync(RUN_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  const log = openSync(path.join(LOG_DIR, `${name}.log`), "a");
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, ...env },
  });
  child.unref();
  writeFileSync(pidFile(name), String(child.pid));
  console.log(`[stack] khởi động ${name} (pid ${child.pid})`);
}

export async function stopProcess(name: string): Promise<void> {
  const pid = runningPid(name);
  if (pid) {
    process.kill(pid, "SIGTERM");
    const deadline = Date.now() + 10_000;
    while (isAlive(pid) && Date.now() < deadline) await sleep(100);
    if (isAlive(pid)) process.kill(pid, "SIGKILL");
    console.log(`[stack] đã dừng ${name}`);
  }
  rmSync(pidFile(name), { force: true });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForHttp(name: string, url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // chưa sẵn sàng
    }
    if (runningPid(name) === null) {
      throw new Error(`${name} đã thoát — xem .stack/logs/${name}.log`);
    }
    await sleep(250);
  }
  throw new Error(`${name} không sẵn sàng sau ${timeoutMs}ms — xem .stack/logs/${name}.log`);
}
