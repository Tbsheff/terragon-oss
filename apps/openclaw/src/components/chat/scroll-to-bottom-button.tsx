"use client";

import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ScrollToBottomButtonProps = {
  visible: boolean;
  onClick: () => void;
  className?: string;
};

export function ScrollToBottomButton({
  visible,
  onClick,
  className,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute bottom-4 right-4 z-10 rounded-full border border-border bg-background p-2 shadow-md transition-all duration-200",
        "hover:bg-muted",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
        className,
      )}
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
