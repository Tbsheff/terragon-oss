"use client";

import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ErrorIndicatorProps = {
  message: string;
  className?: string;
};

export function ErrorIndicator({ message, className }: ErrorIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle
          className={cn("h-3.5 w-3.5 text-destructive", className)}
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}
