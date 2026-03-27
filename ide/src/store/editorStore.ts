import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface EditorState {
  jumpToLine: ((line: number) => void) | null;
  viewStates: Record<string, unknown>;
  setJumpToLine: (fn: ((line: number) => void) | null) => void;
  saveViewState: (fileId: string, viewState: unknown) => void;
  getViewState: (fileId: string) => unknown;
}

const sessionStorageFactory = () => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  return window.sessionStorage;
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      jumpToLine: null,
      viewStates: {},
      setJumpToLine: (fn) => set({ jumpToLine: fn }),
      saveViewState: (fileId, viewState) =>
        set((state) => ({
          viewStates: {
            ...state.viewStates,
            [fileId]: viewState,
          },
        })),
      getViewState: (fileId) => get().viewStates[fileId] ?? null,
    }),
    {
      name: "editor-session-state",
      storage: createJSONStorage(sessionStorageFactory),
      partialize: (state) => ({ viewStates: state.viewStates }),
    },
  ),
);
