"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Columns3,
  Bot,
  FileText,
  Zap,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenClawTaskList } from "./openclaw-task-list";
import { ConnectionStatusBadge } from "./connection-status";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/board", icon: Columns3, label: "Board" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/templates", icon: FileText, label: "Templates" },
  { href: "/automations", icon: Zap, label: "Automations" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          OC
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">
          OpenClaw
        </span>
        <div className="ml-auto">
          <ConnectionStatusBadge />
        </div>
      </div>

      {/* New Task button */}
      <div className="px-3 py-2">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
          )}
        >
          <Plus className="h-4 w-4" />
          New Task
        </Link>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Task List */}
      <div className="flex-1 overflow-hidden border-t border-border mt-2">
        <OpenClawTaskList />
      </div>
    </aside>
  );
}
