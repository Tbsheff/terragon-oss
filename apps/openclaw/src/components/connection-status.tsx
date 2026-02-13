"use client";

import { useConnection, type ConnectionStatus } from "@/hooks/use-connection";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusConfig: Record<
  ConnectionStatus,
  { color: string; pulseColor: string; label: string }
> = {
  connected: {
    color: "bg-emerald-500",
    pulseColor: "bg-emerald-400",
    label: "Connected",
  },
  reconnecting: {
    color: "bg-yellow-500",
    pulseColor: "bg-yellow-400",
    label: "Reconnecting",
  },
  disconnected: {
    color: "bg-red-500",
    pulseColor: "bg-red-400",
    label: "Disconnected",
  },
};

export function ConnectionStatusBadge() {
  const { status, lastCheck, health, isLoading } = useConnection();

  const config = statusConfig[status];

  const tooltipLines = isLoading
    ? "Checking connection..."
    : [
        `Status: ${config.label}`,
        health?.version ? `Version: ${health.version}` : null,
        lastCheck
          ? `Last check: ${new Date(lastCheck).toLocaleTimeString()}`
          : null,
        health?.error ? `Error: ${health.error}` : null,
      ]
        .filter(Boolean)
        .join("\n");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-sidebar-accent transition-colors">
          <span className="relative flex h-2 w-2 shrink-0">
            {status === "connected" && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  config.pulseColor,
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                config.color,
              )}
            />
          </span>
          <span className="text-muted-foreground group-data-[collapsible=icon]:hidden">
            {isLoading ? "Checking..." : config.label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="whitespace-pre-line text-xs">
        {tooltipLines}
      </TooltipContent>
    </Tooltip>
  );
}
