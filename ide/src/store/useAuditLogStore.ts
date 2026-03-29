import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/utils/idbStorage";

export type AuditCategory =
  | "build"
  | "deploy"
  | "test"
  | "settings"
  | "network"
  | "clippy"
  | "security-audit";

export type AuditStatus = "success" | "failure" | "pending";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  action: string;
  status: AuditStatus;
  user: string;
  params: Record<string, unknown>;
  details: string;
  rawJson: Record<string, unknown>;
}

interface AuditLogStore {
  logs: AuditLogEntry[];
  addLog: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => string;
  updateLog: (id: string, update: Partial<Pick<AuditLogEntry, "status" | "details" | "params" | "rawJson">>) => void;
  clearLogs: () => void;
}

export const useAuditLogStore = create<AuditLogStore>()(
  persist(
    (set) => ({
      logs: [],

      addLog: (entry) => {
        const id = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);

        const record: AuditLogEntry = {
          ...entry,
          id,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          // Keep max 500 entries (oldest dropped first)
          logs: [record, ...state.logs].slice(0, 500),
        }));

        return id;
      },

      updateLog: (id, update) =>
        set((state) => ({
          logs: state.logs.map((l) =>
            l.id === id ? { ...l, ...update } : l
          ),
        })),

      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: "stellar-suite:audit-logs",
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
