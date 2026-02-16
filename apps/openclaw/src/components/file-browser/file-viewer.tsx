"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/hooks/use-file-panel";
import { detectLanguage } from "@/lib/language-detect";
import type { BundledLanguage } from "shiki";
import {
  CodeBlockContent,
  CodeBlockContainer,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
  CodeBlockActions,
} from "@/components/ai-elements/code-block";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckIcon, CopyIcon, FileCode } from "lucide-react";

export function FileViewer() {
  const file = useAtomValue(selectedFileAtom);

  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <FileCode className="size-8 opacity-40" />
          <span className="text-balance font-medium">No file selected</span>
          <p className="text-xs text-pretty text-muted-foreground/60">
            Click a file in the tree or a tool result to view it
          </p>
        </div>
      </div>
    );
  }

  const filename = file.path.split("/").pop() ?? file.path;
  const language = (file.language ||
    detectLanguage(file.path)) as BundledLanguage;
  const lineCount = file.content.split("\n").length;

  return (
    <ScrollArea className="flex-1">
      <CodeBlockContainer language={language} className="border-0 rounded-none">
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>{filename}</CodeBlockFilename>
            <span className="tabular-nums text-muted-foreground/60">
              {lineCount} lines
            </span>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CopyButton text={file.content} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent
          code={file.content}
          language={language}
          showLineNumbers
        />
      </CodeBlockContainer>
    </ScrollArea>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [text]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy file contents"}
      className="size-6 shrink-0 hover:bg-muted"
    >
      <Icon className="size-3" />
    </Button>
  );
}
