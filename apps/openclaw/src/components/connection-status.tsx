"use client";

import { useConnection, type ConnectionStatus } from "@/hooks/use-connection";
import { cn } from "@/lib/utils";
import { SidebarMenuButton } from "@/components/ui/sidebar";

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

function StatusDot({
  status,
  config,
}: {
  status: ConnectionStatus;
  config: (typeof statusConfig)[ConnectionStatus];
}) {
  return (
    <span className="relative flex size-4 items-center justify-center shrink-0">
      {status === "connected" && (
        <span
          className={cn(
            "absolute inline-flex size-2 animate-ping rounded-full opacity-75",
            config.pulseColor,
          )}
        />
      )}
      <span
        className={cn("relative inline-flex size-2 rounded-full", config.color)}
      />
    </span>
  );
}

export function ConnectionStatusBadge() {
  const { status, lastCheck, health, isLoading, connectError } =
    useConnection();

  const config = statusConfig[status];

  const tooltipLines = isLoading
    ? "Checking connection..."
    : [
        `Status: ${config.label}`,
        health?.version ? `Version: ${health.version}` : null,
        lastCheck
          ? `Last check: ${new Date(lastCheck).toLocaleTimeString()}`
          : null,
        connectError ? `${connectError.code}: ${connectError.message}` : null,
        connectError?.hint ? `Hint: ${connectError.hint}` : null,
      ]
        .filter(Boolean)
        .join(" \u00b7 ");

  return (
    <SidebarMenuButton
      tooltip={tooltipLines}
      className="cursor-default hover:bg-transparent active:bg-transparent"
    >
      <StatusDot status={status} config={config} />
      <span className="truncate text-muted-foreground text-xs text-pretty">
        {isLoading ? "Checking..." : config.label}
      </span>
    </SidebarMenuButton>
  );
}
