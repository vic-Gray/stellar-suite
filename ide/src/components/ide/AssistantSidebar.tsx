"use client";

import { useState } from "react";
import { Bot, Rocket } from "lucide-react";

import { AIChatPane } from "@/components/ide/AIChatPane";
import { ContractPanel } from "@/components/ide/ContractPanel";
import type { ActiveFileContext } from "@/lib/ai-chat";
import type { InvocationDebugData } from "@/lib/invokeResult";

interface AssistantSidebarProps {
  activeFile: ActiveFileContext | null;
  contractId: string | null;
  onInvoke: (fn: string, args: string) => void;
  lastInvocation?: InvocationDebugData | null;
}

type AssistantTab = "interact" | "ai";

export function AssistantSidebar({
  activeFile,
  contractId,
  onInvoke,
  lastInvocation = null,
}: AssistantSidebarProps) {
  const [activeTab, setActiveTab] = useState<AssistantTab>("ai");

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="grid grid-cols-2 border-b border-border bg-background/50 p-2">
        <button
          type="button"
          onClick={() => setActiveTab("interact")}
          className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "interact"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Rocket className="h-4 w-4" />
          Interact
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "ai"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Bot className="h-4 w-4" />
          AI Chat
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "interact" ? (
          <ContractPanel contractId={contractId} onInvoke={onInvoke} lastInvocation={lastInvocation} />
        ) : (
          <AIChatPane activeFile={activeFile} />
        )}
      </div>
    </div>
  );
}
