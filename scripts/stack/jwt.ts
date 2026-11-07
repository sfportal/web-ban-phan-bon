import { createHmac } from "node:crypto";
import { JWT_SECRET } from "./config";

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function signHs256(payload: Record<string, unknown>, secret = JWT_SECRET): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

// Khoá cố định (iat/exp cố định) để .env không đổi giữa các lần chạy.
const IAT = 1_700_000_000;
const EXP = 2_000_000_000;

export const ANON_KEY = signHs256({ iss: "supabase-local", role: "anon", iat: IAT, exp: EXP });
export const SERVICE_ROLE_KEY = signHs256({
  iss: "supabase-local",
  role: "service_role",
  iat: IAT,
  exp: EXP,
});
