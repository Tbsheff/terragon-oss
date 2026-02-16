"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  SquarePen,
  Bot,
  Clock,
  Settings,
  Sun,
  Moon,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnection, type ConnectionStatus } from "@/hooks/use-connection";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  match?: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    icon: SquarePen,
    label: "New Chat",
    href: "/",
    match: (pathname: string) =>
      pathname === "/" || pathname.startsWith("/task/"),
  },
  { icon: Bot, label: "Agents", href: "/agents" },
  { icon: Clock, label: "Automations", href: "/automations" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

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

function ConnectionDot() {
  const { status, isLoading } = useConnection();
  const config = statusConfig[status];
  const label = isLoading ? "Checking..." : config.label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center size-9 rounded-md cursor-default"
          aria-label={label}
        >
          <span className="relative flex size-4 items-center justify-center">
            {status === "connected" && (
              <span
                className={cn(
                  "absolute inline-flex size-2 animate-ping rounded-full opacity-75",
                  config.pulseColor,
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                config.color,
              )}
            />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center size-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="Toggle theme"
            >
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="size-4" />
          Light
          {theme === "light" && <span className="ml-auto text-xs">*</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="size-4" />
          Dark
          {theme === "dark" && <span className="ml-auto text-xs">*</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="size-4" />
          System
          {theme === "system" && <span className="ml-auto text-xs">*</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center w-14 shrink-0 bg-background border-r border-border py-3 gap-1">
      {navItems.map((item) => {
        const isActive = item.match
          ? item.match(pathname)
          : pathname.startsWith(item.href);

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center justify-center size-9 rounded-md transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
                aria-label={item.label}
              >
                <item.icon className="size-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        <ConnectionDot />
        <ThemeToggle />
      </div>
    </nav>
  );
}
