import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CompileRequestError,
  compileWorkspace,
  createBuildWorkspacePayload,
} from "@/lib/build-contract";
import { sampleContracts } from "@/lib/sample-contracts";

describe("build-contract helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flattens the workspace into a JSON-friendly payload", () => {
    const payload = createBuildWorkspacePayload(sampleContracts, "testnet");

    expect(payload.network).toBe("testnet");
    expect(payload.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "hello_world/lib.rs",
          language: "rust",
        }),
        expect.objectContaining({
          path: "hello_world/Cargo.toml",
          language: "toml",
        }),
        expect.objectContaining({
          path: "token/lib.rs",
          language: "rust",
        }),
      ])
    );
  });

  it("normalizes a JSON compile response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          output: '{"reason":"build-finished","success":true}',
          contractHash: "abc123",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await compileWorkspace(
      createBuildWorkspacePayload(sampleContracts, "testnet")
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      success: true,
      output: '{"reason":"build-finished","success":true}',
      contractHash: "abc123",
    });
  });

  it("throws a typed error for HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("upstream compiler unavailable", { status: 503 })
      )
    );

    await expect(
      compileWorkspace(createBuildWorkspacePayload(sampleContracts, "testnet"))
    ).rejects.toEqual(
      expect.objectContaining<Partial<CompileRequestError>>({
        name: "CompileRequestError",
        status: 503,
        responseBody: "upstream compiler unavailable",
      })
    );
  });
});
