"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createThread } from "@/server-actions/threads";
import { listAgents } from "@/server-actions/agents";
import { Loader2, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODELS = [
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-opus-4-20250514", label: "Opus 4" },
  { id: "claude-haiku-3-5-20241022", label: "Haiku 3.5" },
] as const;

export function NewChatPage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("default");
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [isCreating, setIsCreating] = useState(false);

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const result = await listAgents();
      if (!result.ok) return [];
      return result.data;
    },
  });

  const handleCreate = useCallback(async () => {
    if (!prompt.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const result = await createThread({
        name: prompt.slice(0, 100),
        agentId: selectedAgentId === "default" ? undefined : selectedAgentId,
        model: selectedModel || undefined,
        initialPrompt: prompt,
      });
      router.push(`/task/${result.id}`);
    } catch {
      setIsCreating(false);
    }
  }, [prompt, selectedAgentId, selectedModel, isCreating, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCreate();
      }
    },
    [handleCreate],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <h1 className="text-foreground mb-6 text-2xl font-semibold">
        What can I help you with?
      </h1>

      <div className="border-border bg-muted/30 ring-ring/50 w-full max-w-2xl rounded-2xl border shadow-sm transition-shadow focus-within:ring-1">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Describe a task..."
          className="placeholder:text-muted-foreground/60 min-h-[60px] max-h-[200px] w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm focus:outline-none"
          disabled={isCreating}
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            {agents && agents.length > 0 && (
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
              >
                <SelectTrigger className="h-7 border-0 bg-transparent text-xs shadow-none">
                  <SelectValue placeholder="Default Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.emoji ? `${agent.emoji} ` : ""}
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-7 border-0 bg-transparent text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="icon"
            className="size-8 rounded-full"
            disabled={!prompt.trim() || isCreating}
            onClick={handleCreate}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
