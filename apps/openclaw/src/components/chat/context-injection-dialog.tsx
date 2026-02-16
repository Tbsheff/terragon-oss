"use client";

import { useState, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContextInjectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInject: (content: string, role: "system" | "user") => Promise<void>;
};

export function ContextInjectionDialog({
  open,
  onOpenChange,
  onInject,
}: ContextInjectionDialogProps) {
  const [content, setContent] = useState("");
  const [role, setRole] = useState<"system" | "user">("system");
  const [loading, setLoading] = useState(false);

  const handleInject = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await onInject(trimmed, role);
      setContent("");
      setRole("system");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [content, role, onInject, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inject Context</DialogTitle>
          <DialogDescription>
            Add a message to the session without triggering a response.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select
            value={role}
            onValueChange={(v) => setRole(v as "system" | "user")}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter context to inject..."
            className="min-h-[120px] resize-none"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleInject}
            disabled={!content.trim() || loading}
          >
            {loading ? "Injecting..." : "Inject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
