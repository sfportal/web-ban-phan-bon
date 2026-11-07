import { describe, expect, it } from "vitest";
import { upsertEnv } from "@/scripts/stack/env-file";

describe("upsertEnv", () => {
  it("thêm biến vào file rỗng", () => {
    expect(upsertEnv("", { A: "1", B: "2" })).toBe("A=1\nB=2\n");
  });

  it("thay giá trị cũ, giữ dòng khác và comment", () => {
    const before = "# ghi chú\nA=old\nRESEND_API_KEY=re_123\n";
    expect(upsertEnv(before, { A: "new", B: "2" })).toBe(
      "# ghi chú\nA=new\nRESEND_API_KEY=re_123\nB=2\n",
    );
  });
});
