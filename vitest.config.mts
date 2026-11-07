import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "."),
  // Gói `server-only` throw khi import ngoài React Server Components.
  "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
};

function loadEnvTest(): Record<string, string> {
  const file = path.resolve(import.meta.dirname, ".env.test");
  if (!existsSync(file)) return {};
  return parseEnv(readFileSync(file, "utf8")) as Record<string, string>;
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          env: loadEnvTest(),
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
