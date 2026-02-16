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
        <div className="flex flex-col items-center gap-2">
          <FileCode className="h-8 w-8 opacity-40" />
          <span>No file selected</span>
          <span className="text-xs text-muted-foreground/60">
            Click a file in the tree or a tool result to view it
          </span>
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
            <span className="text-muted-foreground/60">{lineCount} lines</span>
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>(
    0 as unknown as ReturnType<typeof setTimeout>,
  );

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
      className="h-6 w-6 shrink-0"
    >
      <Icon size={12} />
    </Button>
  );
}
