"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  type AuditCategory,
  type AuditLogEntry,
  type AuditStatus,
  useAuditLogStore,
} from "@/store/useAuditLogStore";

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<
  AuditCategory,
  { label: string; className: string }
> = {
  build: {
    label: "Build",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  deploy: {
    label: "Deploy",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
  test: {
    label: "Test",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  settings: {
    label: "Settings",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  network: {
    label: "Network",
    className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  clippy: {
    label: "Clippy",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  "security-audit": {
    label: "Audit",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

const STATUS_META: Record<
  AuditStatus,
  { label: string; className: string }
> = {
  success: {
    label: "Success",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  failure: {
    label: "Failed",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
};

const ALL_CATEGORIES: AuditCategory[] = [
  "build",
  "deploy",
  "test",
  "settings",
  "network",
  "clippy",
  "security-audit",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function paramsPreview(params: Record<string, unknown>): string {
  const entries = Object.entries(params).slice(0, 3);
  return entries
    .map(([k, v]) => {
      const val = String(v);
      return `${k}: ${val.length > 20 ? val.slice(0, 20) + "…" : val}`;
    })
    .join("  ·  ");
}

// ---------------------------------------------------------------------------
// Single log entry row
// ---------------------------------------------------------------------------

function LogEntryRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_META[entry.category];
  const st = STATUS_META[entry.status];

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors group"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Row 1: timestamp + status */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground">
            {formatTs(entry.timestamp)}
          </span>
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 border ${st.className}`}
            >
              {st.label}
            </Badge>
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            )}
          </div>
        </div>

        {/* Row 2: category badge + action */}
        <div className="flex items-center gap-1.5 mb-1">
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 border shrink-0 ${cat.className}`}
          >
            {cat.label}
          </Badge>
          <span className="text-xs font-medium text-foreground truncate">
            {entry.action}
          </span>
        </div>

        {/* Row 3: user + params preview */}
        <div className="text-[10px] text-muted-foreground truncate">
          <span className="font-medium">{entry.user}</span>
          {Object.keys(entry.params).length > 0 && (
            <span className="ml-1.5 opacity-70">
              · {paramsPreview(entry.params)}
            </span>
          )}
        </div>

        {/* Row 4: details */}
        {entry.details && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate italic">
            {entry.details}
          </p>
        )}
      </button>

      {/* Expanded: raw JSON */}
      {expanded && (
        <div className="mx-3 mb-2.5 rounded-md border border-border bg-muted/30 overflow-hidden">
          <div className="px-2 py-1.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Raw JSON
            </span>
          </div>
          <pre className="p-2 text-[10px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {JSON.stringify(entry.rawJson, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function AuditLogView() {
  const { logs, clearLogs } = useAuditLogStore();

  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<AuditCategory>>(
    new Set()
  );
  const [statusFilter, setStatusFilter] = useState<AuditStatus | "all">("all");

  const toggleCategory = (cat: AuditCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return logs.filter((entry) => {
      if (activeCategories.size > 0 && !activeCategories.has(entry.category))
        return false;
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.user.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        JSON.stringify(entry.params).toLowerCase().includes(q)
      );
    });
  }, [logs, search, activeCategories, statusFilter]);

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Audit Log
            </span>
            {logs.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 h-4"
              >
                {logs.length}
              </Badge>
            )}
          </div>
          {logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("Clear all audit logs?")) clearLogs();
              }}
              title="Clear all logs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="h-7 pl-6 pr-6 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                  active
                    ? `${meta.className} border`
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(["all", "success", "failure", "pending"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors capitalize ${
                statusFilter === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-4 text-center">
            <ClipboardList className="h-8 w-8 opacity-20" />
            <p className="text-xs">
              {logs.length === 0
                ? "No audit events yet. Actions like builds and deploys will appear here."
                : "No entries match your filters."}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((entry) => (
              <LogEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <div className="shrink-0 px-3 py-1.5 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            {filtered.length === logs.length
              ? `${logs.length} event${logs.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${logs.length} events`}
          </p>
        </div>
      )}
    </div>
  );
}
