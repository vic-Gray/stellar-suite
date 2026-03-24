import { useState, useCallback, useEffect } from "react";
import { FileExplorer } from "@/components/ide/FileExplorer";
import { EditorTabs } from "@/components/ide/EditorTabs";
import CodeEditor from "@/components/editor/CodeEditor";
import { Terminal, LogEntry } from "@/components/ide/Terminal";
import { Toolbar } from "@/components/ide/Toolbar";
import { ContractPanel } from "@/components/ide/ContractPanel";
import { StatusBar } from "@/components/ide/StatusBar";
import { FileNode } from "@/lib/sample-contracts";
import { useFileStore } from "@/store/useFileStore";
import {
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  FolderTree, Rocket, X, FileText, Terminal as TerminalIcon,
} from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

const findNode = (nodes: FileNode[], pathParts: string[]): FileNode | null => {
  for (const node of nodes) {
    if (node.name === pathParts[0]) {
      if (pathParts.length === 1) return node;
      if (node.children) return findNode(node.children, pathParts.slice(1));
    }
  }
  return null;
};

const Index = () => {
  const {
    files,
    openTabs,
    activeTabPath,
    unsavedFiles,
    setActiveTabPath,
    addTab,
    closeTab,
    createFile,
    createFolder,
    deleteNode,
    renameNode,
    markSaved,
  } = useFileStore();

  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [network, setNetwork] = useState("testnet");
  const [isCompiling, setIsCompiling] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [saveStatus, setSaveStatus] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"none" | "explorer" | "interact">("none");

  // Desktop defaults — show panels on wide screens
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) {
      setShowExplorer(true);
      setShowPanel(true);
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setShowExplorer(true);
        setShowPanel(true);
      } else {
        setShowExplorer(false);
        setShowPanel(false);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const getTimestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { type, message, timestamp: getTimestamp() }]);
  }, []);

  const handleFileSelect = useCallback((path: string[], file: FileNode) => {
    if (file.type !== "file") return;
    addTab(path, file.name);
    // Close mobile explorer after selection
    setMobilePanel("none");
  }, [addTab]);

  const handleTabClose = useCallback((path: string[]) => {
    closeTab(path);
  }, [closeTab]);

  const handleSave = useCallback(() => {
    markSaved(activeTabPath);
    setSaveStatus("Saved");
    setTimeout(() => setSaveStatus(""), 2000);
  }, [activeTabPath, markSaved]);

  // Global Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleCompile = useCallback(() => {
    setIsCompiling(true);
    setTerminalExpanded(true);
    addLog("info", "Compiling contract...");
    addLog("info", `Target network: ${network}`);
    setTimeout(() => addLog("info", "Resolving dependencies..."), 400);
    setTimeout(() => addLog("info", "Building release target..."), 900);
    setTimeout(() => {
      addLog("success", "✓ Compilation successful! WASM binary: 1.2 KB");
      addLog("info", "Contract hash: 7a8b9c...d4e5f6");
      setIsCompiling(false);
    }, 1800);
  }, [network, addLog]);

  const handleDeploy = useCallback(() => {
    setTerminalExpanded(true);
    addLog("info", `Deploying to ${network}...`);
    setTimeout(() => {
      const id = "CDLZ...X7YQ";
      setContractId(id);
      addLog("success", `✓ Contract deployed! ID: ${id}`);
    }, 2000);
  }, [network, addLog]);

  const handleTest = useCallback(() => {
    setTerminalExpanded(true);
    addLog("info", "Running tests...");
    setTimeout(() => {
      addLog("success", "✓ test_hello ... ok");
      addLog("info", "test result: ok. 1 passed; 0 failed;");
    }, 1200);
  }, [addLog]);

  const handleInvoke = useCallback((fn: string, args: string) => {
    setTerminalExpanded(true);
    addLog("info", `Invoking ${fn}(${args})...`);
    setTimeout(() => addLog("success", `✓ Result: ["Hello", "Dev"]`), 800);
  }, [addLog]);

  useEffect(() => {
    const onBuild = () => handleCompile();
    const onDeploy = () => handleDeploy();
    const onTest = () => handleTest();

    window.addEventListener("ide:build-contract", onBuild);
    window.addEventListener("ide:deploy-contract", onDeploy);
    window.addEventListener("ide:run-tests", onTest);

    return () => {
      window.removeEventListener("ide:build-contract", onBuild);
      window.removeEventListener("ide:deploy-contract", onDeploy);
      window.removeEventListener("ide:run-tests", onTest);
    };
  }, [handleCompile, handleDeploy, handleTest]);

  const { content, language } = getActiveContent();

  // Tabs with unsaved markers
  const tabsWithStatus = openTabs.map((t) => ({
    ...t,
    unsaved: unsavedFiles.has(t.path.join("/")),
  }));

  const activeFile = findNode(files, activeTabPath);
  const language = activeFile?.language || "rust";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toolbar */}
      <Toolbar
        onCompile={handleCompile}
        onDeploy={handleDeploy}
        onTest={handleTest}
        isCompiling={isCompiling}
        network={network}
        onNetworkChange={setNetwork}
        saveStatus={saveStatus}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toggle Bar */}
        <div className="hidden md:flex flex-col bg-sidebar border-r border-border shrink-0 z-10">
          <button
            onClick={() => setShowExplorer(!showExplorer)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle Explorer"
          >
            {showExplorer ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile overlay panels */}
        {mobilePanel === "explorer" && (
          <div className="md:hidden absolute inset-0 z-30 flex">
            <div className="w-64 bg-sidebar border-r border-border h-full">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Explorer</span>
                <button title="Close Explorer" onClick={() => setMobilePanel("none")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FileExplorer
                files={files}
                onFileSelect={handleFileSelect}
                activeFilePath={activeTabPath}
                onCreateFile={(parent, name) => createFile(parent, name)}
                onCreateFolder={createFolder}
                onDeleteNode={deleteNode}
                onRenameNode={renameNode}
              />
            </div>
            <div className="flex-1 bg-background/60" onClick={() => setMobilePanel("none")} />
          </div>
        )}
        {mobilePanel === "interact" && (
          <div className="md:hidden absolute inset-0 z-30 flex justify-end">
            <div className="flex-1 bg-background/60" onClick={() => setMobilePanel("none")} />
            <div className="w-72 bg-card border-l border-border h-full">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Interact</span>
                <button title="Close Interact" onClick={() => setMobilePanel("none")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ContractPanel contractId={contractId} onInvoke={handleInvoke} />
            </div>
          </div>
        )}

        {/* Resizable Layout for Desktop Content */}
        <div className="flex-1 flex overflow-hidden">
          <ResizablePanelGroup direction="horizontal" autoSaveId="ide-main-layout">
            
            {showExplorer && (
              <>
                <ResizablePanel id="explorer" order={1} defaultSize={20} minSize={10} maxSize={40} className="hidden md:block">
                  <div className="h-full w-full overflow-hidden border-r border-border bg-sidebar">
                    <FileExplorer
                      files={files}
                      onFileSelect={handleFileSelect}
                      activeFilePath={activeTabPath}
                      onCreateFile={(parent, name) => createFile(parent, name)}
                      onCreateFolder={createFolder}
                      onDeleteNode={deleteNode}
                      onRenameNode={renameNode}
                    />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle className="hidden md:flex" />
              </>
            )}

            <ResizablePanel id="main-content" order={2} minSize={30} className="flex flex-col min-w-0">
              <ResizablePanelGroup direction="vertical" autoSaveId="ide-editor-terminal">
                
                <ResizablePanel id="editor" order={1} defaultSize={75} minSize={30} className="flex flex-col min-w-0">
                  <EditorTabs
                    tabs={tabsWithStatus}
                    activeTab={activeTabPath.join("/")}
                    onTabSelect={setActiveTabPath}
                    onTabClose={handleTabClose}
                  />
                  <div className="flex-1 overflow-hidden">
                    <CodeEditor
                      onCursorChange={(line, col) => setCursorPos({ line, col })}
                      onSave={handleSave}
                    />
                  </div>
                </ResizablePanel>

                {terminalExpanded ? (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel id="terminal" order={2} defaultSize={25} minSize={10} className="flex flex-col min-w-0">
                      <Terminal
                        logs={logs}
                        isExpanded={terminalExpanded}
                        onToggle={() => setTerminalExpanded(!terminalExpanded)}
                        onClear={() => setLogs([])}
                      />
                    </ResizablePanel>
                  </>
                ) : (
                  <div className="shrink-0 flex flex-col min-w-0">
                    <Terminal
                      logs={logs}
                      isExpanded={terminalExpanded}
                      onToggle={() => setTerminalExpanded(!terminalExpanded)}
                      onClear={() => setLogs([])}
                    />
                  </div>
                )}

              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Desktop contract panel */}
        <div className="hidden md:flex shrink-0 z-10">
          {showPanel && (
            <div className="w-64 border-l border-border bg-card">
              <ContractPanel contractId={contractId} onInvoke={handleInvoke} />
            </div>
          )}
          <div className="flex flex-col bg-card border-l border-border h-full">
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle Panel"
            >
              {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar - Desktop */}
      <div className="hidden md:block">
        <StatusBar
          language={language}
          line={cursorPos.line}
          col={cursorPos.col}
          network={network}
          unsavedCount={unsavedFiles.size}
        />
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden flex flex-col border-t border-border bg-sidebar">
        {/* Status row */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            {unsavedFiles.size > 0 && <span className="text-warning">{unsavedFiles.size} unsaved</span>}
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{network}</span>
        </div>
        {/* Tab buttons */}
        <div className="flex items-stretch">
          <button
            onClick={() => setMobilePanel(mobilePanel === "explorer" ? "none" : "explorer")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors border-t-2 ${
              mobilePanel === "explorer"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderTree className="h-4 w-4" />
            Explorer
          </button>
          <button
            onClick={() => setMobilePanel("none")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors border-t-2 ${
              mobilePanel === "none"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Editor
          </button>
          <button
            onClick={() => setMobilePanel(mobilePanel === "interact" ? "none" : "interact")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors border-t-2 ${
              mobilePanel === "interact"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Rocket className="h-4 w-4" />
            Interact
          </button>
          <button
            onClick={() => { setTerminalExpanded(!terminalExpanded); setMobilePanel("none"); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors border-t-2 ${
              terminalExpanded
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <TerminalIcon className="h-4 w-4" />
            Console
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
