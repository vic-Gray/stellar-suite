import { create } from "zustand";

export type LiveShareMode = "broadcaster" | "recipient" | "none";

interface LiveShareState {
  isSharing: boolean;
  sessionId: string | null;
  mode: LiveShareMode;
  peerCount: number;
  shareLink: string | null;

  // Actions
  startSharing: (sessionId: string) => void;
  stopSharing: () => void;
  joinSession: (sessionId: string) => void;
  setPeerCount: (count: number) => void;
  reset: () => void;
}

export const useLiveShareStore = create<LiveShareState>((set) => ({
  isSharing: false,
  sessionId: null,
  mode: "none",
  peerCount: 0,
  shareLink: null,

  startSharing: (sessionId) => {
    const link = `${window.location.origin}/share/${sessionId}`;
    set({
      isSharing: true,
      sessionId,
      mode: "broadcaster",
      shareLink: link,
    });
  },

  stopSharing: () => {
    set({
      isSharing: false,
      sessionId: null,
      mode: "none",
      shareLink: null,
      peerCount: 0,
    });
  },

  joinSession: (sessionId) => {
    set({
      isSharing: false,
      sessionId,
      mode: "recipient",
      shareLink: null,
    });
  },

  setPeerCount: (count) => set({ peerCount: count }),

  reset: () => {
    set({
      isSharing: false,
      sessionId: null,
      mode: "none",
      shareLink: null,
      peerCount: 0,
    });
  },
}));
