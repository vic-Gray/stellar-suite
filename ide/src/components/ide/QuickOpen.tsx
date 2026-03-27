"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import fuzzysort from "fuzzysort";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { FileNode } from "@/lib/sample-contracts";

type QuickOpenFile = {
  id: string;
  name: string;
  path: string;
};

const RECENT_STORAGE_KEY = "ide.quick-open.recents";
const MAX_RECENTS = 20;

const FALLBACK_FILES: QuickOpenFile[] = [
  { id: "fallback-1", name: "lib.rs", path: "hello_world/lib.rs" },
  { id: "fallback-2", name: "Cargo.toml", path: "hello_world/Cargo.toml" },
  { id: "fallback-3", name: "README.md", path: "README.md" },
  { id: "fallback-4", name: "tests.rs", path: "hello_world/tests.rs" },
  { id: "fallback-5", name: "stellar.toml", path: "stellar.toml" },
];

const flattenFiles = (
  nodes: FileNode[],
  parentPath: string[] = [],
): QuickOpenFile[] => {
  const result: QuickOpenFile[] = [];

  for (const node of nodes) {
    const nextPath = [...parentPath, node.name];

    if (node.type === "folder") {
      result.push(...flattenFiles(node.children ?? [], nextPath));
      continue;
    }

    const path = nextPath.join("/");
    result.push({ id: path, name: node.name, path });
  }

  return result;
};

const moveToFront = (items: string[], path: string): string[] => {
  return [path, ...items.filter((item) => item !== path)].slice(0, MAX_RECENTS);
};

export function QuickOpen() {
  const files = useWorkspaceStore((state) => state.files);
  const addTab = useWorkspaceStore((state) => state.addTab);
  const setActiveTabPath = useWorkspaceStore((state) => state.setActiveTabPath);

  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  const fileList = useMemo(() => {
    const workspaceFiles = flattenFiles(files);
    return workspaceFiles.length > 0 ? workspaceFiles : FALLBACK_FILES;
  }, [files]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;

      const nextRecents = parsed
        .filter((v): v is string => typeof v === "string")
        .slice(0, MAX_RECENTS);
      setRecentPaths(nextRecents);
    } catch {
      setRecentPaths([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify(recentPaths.slice(0, MAX_RECENTS)),
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [recentPaths]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleOpenEvent = () => setOpen(true);

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("ide:open-file-finder", handleOpenEvent);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("ide:open-file-finder", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const recentIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    recentPaths.forEach((path, index) => map.set(path, index));
    return map;
  }, [recentPaths]);

  const visibleFiles = useMemo(() => {
    if (query.trim().length === 0) {
      return [...fileList].sort((a, b) => {
        const ai = recentIndexMap.get(a.path);
        const bi = recentIndexMap.get(b.path);

        if (ai !== undefined && bi !== undefined) return ai - bi;
        if (ai !== undefined) return -1;
        if (bi !== undefined) return 1;
        return a.path.localeCompare(b.path);
      });
    }

    const fuzzyResults = fuzzysort.go(query, fileList, {
      keys: ["name", "path"],
      limit: 200,
      threshold: -10000,
      scoreFn: (result) => {
        const recentIndex = recentIndexMap.get(result.obj.path);
        const recencyBoost =
          recentIndex === undefined ? 0 : 2000 - recentIndex * 50;
        return result.score + recencyBoost;
      },
    });

    return fuzzyResults.map((result) => result.obj);
  }, [fileList, query, recentIndexMap]);

  const openFile = useCallback(
    (file: QuickOpenFile) => {
      setRecentPaths((prev) => moveToFront(prev, file.path));
      setOpen(false);

      const pathParts = file.path.split("/").filter(Boolean);
      if (pathParts.length === 0) return;

      try {
        addTab(pathParts, file.name);
        setActiveTabPath(pathParts);
      } catch {
        console.log("QuickOpen selected file:", file.path);
      }
    },
    [addTab, setActiveTabPath],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <Command shouldFilter={false} loop>
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search files by name or path..."
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No files found.</CommandEmpty>
            <CommandGroup heading="Files">
              {visibleFiles.map((file) => {
                const isRecent = recentIndexMap.has(file.path);
                return (
                  <CommandItem
                    key={file.id}
                    value={file.path}
                    onSelect={() => openFile(file)}
                    className="flex items-center gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.path}</span>
                    {isRecent ? (
                      <CommandShortcut>Recent</CommandShortcut>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
