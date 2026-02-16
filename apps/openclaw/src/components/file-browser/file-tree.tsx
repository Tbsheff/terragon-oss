"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useOpenFile } from "@/hooks/use-file-panel";
import { detectLanguage } from "@/lib/language-detect";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";

// ─────────────────────────────────────────────────
// Tree data structure
// ─────────────────────────────────────────────────

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
};

function buildTree(files: Map<string, string>): TreeNode[] {
  const root: TreeNode[] = [];

  for (const [filePath] of files) {
    const parts = filePath.startsWith("/")
      ? filePath.slice(1).split("/")
      : filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      const isLast = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);

      if (existing) {
        current = existing.children;
      } else {
        const fullPath = parts.slice(0, i + 1).join("/");
        const node: TreeNode = {
          name,
          path: filePath.startsWith("/") ? "/" + fullPath : fullPath,
          isDir: !isLast,
          children: [],
        };
        current.push(node);
        current = node.children;
      }
    }
  }

  // Sort: dirs first, then alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length > 0) sortNodes(node.children);
    }
  };
  sortNodes(root);

  return root;
}

// ─────────────────────────────────────────────────
// File icon helper
// ─────────────────────────────────────────────────

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "json":
    case "jsonc":
      return (
        <FileJson className="h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
      );
    case "md":
    case "mdx":
    case "txt":
      return (
        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
      );
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "rs":
    case "go":
    case "rb":
    case "java":
    case "c":
    case "cpp":
    case "cs":
    case "swift":
    case "kt":
    case "dart":
      return (
        <FileCode className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      );
    default:
      return <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
}

// ─────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────

type FileTreeProps = {
  files: Map<string, string>;
};

export function FileTree({ files }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  if (tree.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm p-4">
        <div className="flex flex-col items-center gap-2">
          <Folder className="h-8 w-8 opacity-40" />
          <span>No files yet</span>
          <span className="text-xs text-muted-foreground/60">
            Files will appear as the agent reads, writes, or edits them
          </span>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {tree.map((node) => (
          <TreeNodeItem key={node.path} node={node} files={files} depth={0} />
        ))}
      </div>
    </ScrollArea>
  );
}

function TreeNodeItem({
  node,
  files,
  depth,
}: {
  node: TreeNode;
  files: Map<string, string>;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const openFile = useOpenFile();

  const handleFileClick = useCallback(() => {
    const content = files.get(node.path) ?? "";
    openFile({
      path: node.path,
      content,
      language: detectLanguage(node.path),
    });
  }, [node.path, files, openFile]);

  if (node.isDir) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted/60 transition-colors",
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-90",
              )}
            />
            {isOpen ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            )}
            <span className="truncate font-medium text-foreground/90">
              {node.name}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              files={files}
              depth={depth + 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <button
      onClick={handleFileClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted/60 transition-colors",
      )}
      style={{ paddingLeft: `${depth * 12 + 8 + 16}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate text-foreground/80">{node.name}</span>
    </button>
  );
}
