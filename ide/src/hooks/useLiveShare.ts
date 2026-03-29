import { useEffect, useRef, useCallback } from "react";
import { useLiveShareStore } from "@/store/useLiveShareStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { liveShareService, LiveShareMessage } from "@/lib/liveShareService";
import { toast } from "sonner";

/**
 * useLiveShare hook
 *
 * Orchestrates real-time synchronization between broadcaster and recipients.
 */
export function useLiveShare() {
  const { isSharing, sessionId, mode, setPeerCount, stopSharing } = useLiveShareStore();
  const {
    files,
    activeTabPath,
    cursorPos,
    updateFileContent,
    setActiveTabPath,
    setCursorPos,
    setFiles,
  } = useWorkspaceStore();

  const isInitialSync = useRef(true);

  // ── Broadcast Logic ────────────────────────────────────────────────────────

  // Broadcast full project state on initial connection
  useEffect(() => {
    if (isSharing && sessionId && mode === "broadcaster" && isInitialSync.current) {
      const syncProject = async () => {
        await liveShareService.init(sessionId);
        await liveShareService.publish({
          type: "PROJECT_SYNC",
          payload: { files, activeTabPath },
        });
        isInitialSync.current = false;
        
        // Track presence
        await liveShareService.trackPresence(setPeerCount);
      };
      
      syncProject().catch((err) => {
        console.error("Failed to sync project:", err);
        toast.error("Live Share connection failed");
      });
    }
  }, [isSharing, sessionId, mode, files, activeTabPath, setPeerCount]);

  // Broadcast active file changes
  useEffect(() => {
    if (isSharing && mode === "broadcaster") {
      liveShareService.publish({
        type: "ACTIVE_FILE_CHANGE",
        payload: { path: activeTabPath },
      }).catch(console.error);
    }
  }, [activeTabPath, isSharing, mode]);

  // Broadcast cursor position changes
  useEffect(() => {
    if (isSharing && mode === "broadcaster") {
      liveShareService.publish({
        type: "CURSOR_MOVE",
        payload: { pos: cursorPos },
      }).catch(console.error);
    }
  }, [cursorPos, isSharing, mode]);

  // ── Recipient Logic ────────────────────────────────────────────────────────

  const handleRemoteMessage = useCallback((msg: LiveShareMessage) => {
    if (mode !== "recipient") return;

    switch (msg.type) {
      case "PROJECT_SYNC":
        setFiles(msg.payload.files);
        setActiveTabPath(msg.payload.activeTabPath);
        break;
      case "CONTENT_CHANGE":
        const { path, content } = msg.payload;
        updateFileContent(path, content);
        break;
      case "ACTIVE_FILE_CHANGE":
        setActiveTabPath(msg.payload.path);
        break;
      case "CURSOR_MOVE":
        setCursorPos(msg.payload.pos);
        break;
    }
  }, [mode, setFiles, setActiveTabPath, updateFileContent, setCursorPos]);

  useEffect(() => {
    if (mode === "recipient" && sessionId) {
      const initRecipient = async () => {
        await liveShareService.init(sessionId);
        liveShareService.subscribe(handleRemoteMessage);
        
        // Track presence
        await liveShareService.trackPresence(setPeerCount);
        
        toast.info("Connected to live session");
      };
      
      initRecipient().catch((err) => {
        console.error("Failed to join live session:", err);
        toast.error("Failed to join live session");
      });
      
      return () => {
        liveShareService.disconnect();
      };
    }
  }, [mode, sessionId, handleRemoteMessage, setPeerCount]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSharing && mode === "none") {
      liveShareService.disconnect();
      isInitialSync.current = true;
    }
  }, [isSharing, mode]);

  return {
    isSharing,
    sessionId,
    mode,
    // Helper to broadcast content changes (to be called from CodeEditor)
    broadcastContentChange: (path: string[], content: string) => {
      if (isSharing && mode === "broadcaster") {
        liveShareService.publish({
          type: "CONTENT_CHANGE",
          payload: { path, content },
        }).catch(console.error);
      }
    }
  };
}
