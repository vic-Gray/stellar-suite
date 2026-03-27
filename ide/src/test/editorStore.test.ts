import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/store/editorStore";

describe("useEditorStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useEditorStore.setState({
      jumpToLine: null,
      viewStates: {},
    });
  });

  it("stores per-file view state values", () => {
    useEditorStore.getState().saveViewState("contracts/lib.rs", {
      hiddenAreas: [{ startLineNumber: 2, endLineNumber: 8 }],
    });

    expect(useEditorStore.getState().getViewState("contracts/lib.rs")).toEqual({
      hiddenAreas: [{ startLineNumber: 2, endLineNumber: 8 }],
    });
  });

  it("persists view state in session storage", async () => {
    useEditorStore.getState().saveViewState("contracts/lib.rs", {
      hiddenAreas: [{ startLineNumber: 3, endLineNumber: 9 }],
    });

    await Promise.resolve();

    const rawState = sessionStorage.getItem("editor-session-state");
    expect(rawState).toContain("contracts/lib.rs");
    expect(rawState).toContain("hiddenAreas");
  });
});
