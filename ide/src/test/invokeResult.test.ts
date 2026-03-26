import { describe, expect, it } from "vitest";

import { createInvocationDebugData } from "@/lib/invokeResult";

describe("invoke result helpers", () => {
  it("creates copyable unsigned and signed base64 payloads", () => {
    const result = createInvocationDebugData({
      functionName: "hello",
      args: '"Dev"',
      signer: "browser-wallet",
      network: "testnet",
      result: '["Hello","Dev"]',
    });

    expect(result.unsignedXdr).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result.signedXdr).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result.unsignedXdr).not.toBe(result.signedXdr);
    expect(result.createdAt).toContain("T");
  });
});
