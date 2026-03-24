import { create } from 'zustand';
import { FileNode, sampleContracts } from '@/lib/sample-contracts';

interface TabInfo {
  path: string[];
  name: string;
}

interface FileStore {
  files: FileNode[];
  openTabs: TabInfo[];
  activeTabPath: string[];
  unsavedFiles: Set<string>;
  
  // Actions
  setFiles: (files: FileNode[]) => void;
  setActiveTabPath: (path: string[]) => void;
  setOpenTabs: (tabs: TabInfo[]) => void;
  addTab: (path: string[], name: string) => void;
  closeTab: (path: string[]) => void;
  updateFileContent: (path: string[], content: string) => void;
  markSaved: (path: string[]) => void;
  createFile: (parentPath: string[], name: string, content?: string) => void;
  createFolder: (parentPath: string[], name: string) => void;
  deleteNode: (path: string[]) => void;
  renameNode: (path: string[], newName: string) => void;
}

const cloneFiles = (files: FileNode[]): FileNode[] =>
  JSON.parse(JSON.stringify(files));

const findNode = (nodes: FileNode[], pathParts: string[]): FileNode | null => {
  for (const node of nodes) {
    if (node.name === pathParts[0]) {
      if (pathParts.length === 1) return node;
      if (node.children) return findNode(node.children, pathParts.slice(1));
    }
  }
  return null;
};

const findParent = (nodes: FileNode[], pathParts: string[]): FileNode[] | null => {
  if (pathParts.length <= 1) return nodes;
  const parent = findNode(nodes, pathParts.slice(0, -1));
  return parent?.children ?? null;
};

export const useFileStore = create<FileStore>((set, get) => ({
  files: cloneFiles(sampleContracts),
  openTabs: [{ path: ["hello_world", "lib.rs"], name: "lib.rs" }],
  activeTabPath: ["hello_world", "lib.rs"],
  unsavedFiles: new Set<string>(),

  setFiles: (files) => set({ files }),
  setActiveTabPath: (path) => set({ activeTabPath: path }),
  setOpenTabs: (tabs) => set({ openTabs: tabs }),

  addTab: (path, name) => {
    const key = path.join("/");
    const { openTabs } = get();
    if (!openTabs.some(t => t.path.join("/") === key)) {
      set({ openTabs: [...openTabs, { path, name }] });
    }
    set({ activeTabPath: path });
  },

  closeTab: (path) => {
    const key = path.join("/");
    const { openTabs, activeTabPath, unsavedFiles } = get();
    const nextTabs = openTabs.filter(t => t.path.join("/") !== key);
    
    let nextActivePath = activeTabPath;
    if (activeTabPath.join("/") === key && nextTabs.length > 0) {
      nextActivePath = nextTabs[nextTabs.length - 1].path;
    } else if (nextTabs.length === 0) {
        nextActivePath = [];
    }

    const nextUnsaved = new Set(unsavedFiles);
    nextUnsaved.delete(key);

    set({ openTabs: nextTabs, activeTabPath: nextActivePath, unsavedFiles: nextUnsaved });
  },

  updateFileContent: (path, content) => {
    const key = path.join("/");
    const { files, unsavedFiles } = get();
    const nextFiles = cloneFiles(files);
    const node = findNode(nextFiles, path);
    if (node) {
      node.content = content;
      set({ files: nextFiles });
      
      // We could add logic here to compare with "saved" content if needed
      // for now we'll just mark it as unsaved if it's changing
      const nextUnsaved = new Set(unsavedFiles);
      nextUnsaved.add(key);
      set({ unsavedFiles: nextUnsaved });
    }
  },

  markSaved: (path) => {
    const key = path.join("/");
    const { unsavedFiles } = get();
    const nextUnsaved = new Set(unsavedFiles);
    nextUnsaved.delete(key);
    set({ unsavedFiles: nextUnsaved });
  },

  createFile: (parentPath, name, content = "") => {
    const { files } = get();
    const nextFiles = cloneFiles(files);
    const parent = parentPath.length === 0 ? nextFiles : findNode(nextFiles, parentPath)?.children;
    if (parent) {
      parent.push({
        name,
        type: "file",
        language: name.endsWith(".rs") ? "rust" : name.endsWith(".toml") ? "toml" : "text",
        content,
      });
      set({ files: nextFiles });
      get().addTab([...parentPath, name], name);
    }
  },

  createFolder: (parentPath, name) => {
    const { files } = get();
    const nextFiles = cloneFiles(files);
    const parent = parentPath.length === 0 ? nextFiles : findNode(nextFiles, parentPath)?.children;
    if (parent) {
      parent.push({ name, type: "folder", children: [] });
      set({ files: nextFiles });
    }
  },

  deleteNode: (path) => {
    const { files, activeTabPath } = get();
    const nextFiles = cloneFiles(files);
    const parent = findParent(nextFiles, path);
    if (parent) {
      const idx = parent.findIndex(n => n.name === path[path.length - 1]);
      if (idx !== -1) {
        parent.splice(idx, 1);
        set({ files: nextFiles });
        
        // Close tab if open
        get().closeTab(path);
      }
    }
  },

  renameNode: (path, newName) => {
    const { files, openTabs, activeTabPath } = get();
    const oldKey = path.join("/");
    const nextPath = [...path.slice(0, -1), newName];
    const nextKey = nextPath.join("/");

    const nextFiles = cloneFiles(files);
    const node = findNode(nextFiles, path);
    if (node) {
      node.name = newName;
      
      // Update tabs
      const nextTabs = openTabs.map(t => {
        const tKey = t.path.join("/");
        if (tKey === oldKey || tKey.startsWith(oldKey + "/")) {
          const updatedPath = [...nextPath, ...t.path.slice(path.length)];
          return { ...t, path: updatedPath, name: updatedPath[updatedPath.length - 1] };
        }
        return t;
      });

      // Update active tab
      let nextActivePath = activeTabPath;
      if (activeTabPath.join("/") === oldKey || activeTabPath.join("/").startsWith(oldKey + "/")) {
        nextActivePath = [...nextPath, ...activeTabPath.slice(path.length)];
      }

      set({ 
        files: nextFiles, 
        openTabs: nextTabs, 
        activeTabPath: nextActivePath 
      });
    }
  }
}));
