"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { forkThread } from "@/server-actions/fork-thread";
import type { UIMessage } from "@/lib/types";

type ForkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceThreadId: string;
  messageIndex: number;
  message: UIMessage | null;
};

export function ForkDialog({
  open,
  onOpenChange,
  sourceThreadId,
  messageIndex,
  message,
}: ForkDialogProps) {
  const router = useRouter();
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const preview = message ? getMessagePreview(message) : "";

  const handleSubmit = useCallback(async () => {
    if (!newMessage.trim()) return;
    setLoading(true);

    const result = await forkThread({
      sourceThreadId,
      forkAtMessageIndex: messageIndex,
      newMessage: newMessage.trim(),
    });

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onOpenChange(false);
    setNewMessage("");
    router.push(`/task/${result.data.id}`);
  }, [newMessage, sourceThreadId, messageIndex, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 shadow-xs">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-cabin)] tracking-tight text-balance">
            Fork from this point
          </DialogTitle>
          <DialogDescription className="text-xs text-pretty">
            Create a new conversation branching from this message.
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground line-clamp-3">
            {preview}
          </div>
        )}

        <Textarea
          placeholder="Enter your new message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={4}
          autoFocus
          className="bg-muted/20 border-border/60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !newMessage.trim()}
          >
            {loading ? "Forking..." : "Fork"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getMessagePreview(message: UIMessage): string {
  if (message.role === "system") return "";
  for (const part of message.parts) {
    if (part.type === "text") return part.text.slice(0, 200);
  }
  return "";
}
