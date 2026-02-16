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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setContent("");
          setRole("system");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md border-border/60">
        <DialogHeader>
          <DialogTitle className="text-balance font-[var(--font-cabin)]">
            Inject Context
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Add a message to the session without triggering a response.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="context-role" className="text-sm font-medium">
              Role
            </Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "system" | "user")}
            >
              <SelectTrigger
                size="sm"
                id="context-role"
                aria-label="Select role"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="context-content" className="text-sm font-medium">
              Content
            </Label>
            <Textarea
              id="context-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter context to inject..."
              className={cn(
                "focus-glow min-h-[120px] resize-none border-border/60",
              )}
            />
          </div>
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
