import React, { Suspense, useCallback } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useFileStore } from '@/store/useFileStore';

interface CodeEditorProps {
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ onCursorChange, onSave }) => {
  const { activeTabPath, files, updateFileContent } = useFileStore();

  const activeFile = React.useMemo(() => {
    const findNode = (nodes: any[], pathParts: string[]): any | null => {
      for (const node of nodes) {
        if (node.name === pathParts[0]) {
          if (pathParts.length === 1) return node;
          if (node.children) return findNode(node.children, pathParts.slice(1));
        }
      }
      return null;
    };
    return findNode(files, activeTabPath);
  }, [files, activeTabPath]);

  const handleEditorChange: OnChange = (value) => {
    if (value !== undefined) {
      updateFileContent(activeTabPath, value);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Add custom keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Handle cursor change
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    // Set theme
    monaco.editor.defineTheme('stellar-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.foreground': '#cdd6f4',
        'editor.lineHighlightBackground': '#313244',
        'editor.selectionBackground': '#45475a',
        'editorCursor.foreground': '#f5e0dc',
        'editorWhitespace.foreground': '#45475a',
        'editorIndentGuide.background': '#313244',
        'editorIndentGuide.activeBackground': '#45475a',
      },
    });
    monaco.editor.setTheme('stellar-dark');
  };

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e2e] text-muted-foreground font-mono text-sm">
        Select a file to begin editing
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden relative border-t border-border">
      <Suspense fallback={
        <div className="h-full flex items-center justify-center bg-[#1e1e2e] text-muted-foreground font-mono text-xs">
          Loading Editor...
        </div>
      }>
        <Editor
          height="100%"
          defaultLanguage={activeFile.language || "rust"}
          language={activeFile.language || "rust"}
          value={activeFile.content}
          theme="stellar-dark"
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            lineNumbers: "on",
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
        />
      </Suspense>
    </div>
  );
};

export default CodeEditor;
