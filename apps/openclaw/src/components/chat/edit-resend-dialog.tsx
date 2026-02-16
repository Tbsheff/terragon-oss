"use client";

import { useState, useCallback, useEffect } from "react";
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

type EditResendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceThreadId: string;
  messageIndex: number;
  message: UIMessage | null;
};

export function EditResendDialog({
  open,
  onOpenChange,
  sourceThreadId,
  messageIndex,
  message,
}: EditResendDialogProps) {
  const router = useRouter();
  const [editedMessage, setEditedMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-populate with original message text when dialog opens
  useEffect(() => {
    if (open && message) {
      setEditedMessage(extractText(message));
    }
  }, [open, message]);

  const handleSubmit = useCallback(async () => {
    if (!editedMessage.trim()) return;
    setLoading(true);

    // Fork from the message BEFORE this user message
    const forkIndex = Math.max(0, messageIndex - 1);

    const result = await forkThread({
      sourceThreadId,
      forkAtMessageIndex: forkIndex,
      newMessage: editedMessage.trim(),
      name: undefined, // auto-generate name
    });

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onOpenChange(false);
    setEditedMessage("");
    router.push(`/task/${result.data.id}`);
  }, [editedMessage, sourceThreadId, messageIndex, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 shadow-xs">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-cabin)] tracking-tight text-balance">
            Edit &amp; resend
          </DialogTitle>
          <DialogDescription className="text-xs text-pretty">
            Edit your message and resend it in a new forked conversation.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={editedMessage}
          onChange={(e) => setEditedMessage(e.target.value)}
          rows={6}
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
            disabled={loading || !editedMessage.trim()}
          >
            {loading ? "Sending..." : "Resend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractText(message: UIMessage): string {
  if (message.role === "system") return "";
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
}
