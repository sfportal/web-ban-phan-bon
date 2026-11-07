import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

describe("local supabase stack", () => {
  const email = `stack-${Date.now()}@example.test`;
  const password = "mat-khau-thu-123";

  it("service role tạo được user qua auth.admin", async () => {
    const admin = createClient(url, serviceKey, noSession);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(error).toBeNull();
    expect(data.user?.email).toBe(email);
  });

  it("anon đăng nhập bằng mật khẩu và nhận session", async () => {
    const anon = createClient(url, anonKey, noSession);
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });

  it("REST trả 200 với anon apikey", async () => {
    const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: anonKey } });
    expect(res.status).toBe(200);
  });
});
