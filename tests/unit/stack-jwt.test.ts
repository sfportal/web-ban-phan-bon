import { describe, expect, it } from "vitest";
import { ANON_KEY, SERVICE_ROLE_KEY, signHs256 } from "@/scripts/stack/jwt";

const payloadOf = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));

describe("signHs256", () => {
  it("khớp vector chuẩn của jwt.io", () => {
    const jwt = signHs256(
      { sub: "1234567890", name: "John Doe", iat: 1516239022 },
      "your-256-bit-secret",
    );
    expect(jwt).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    );
  });

  it("anon/service key mang đúng role và chưa hết hạn", () => {
    expect(payloadOf(ANON_KEY).role).toBe("anon");
    expect(payloadOf(SERVICE_ROLE_KEY).role).toBe("service_role");
    expect(payloadOf(ANON_KEY).exp * 1000).toBeGreaterThan(Date.now());
  });
});
