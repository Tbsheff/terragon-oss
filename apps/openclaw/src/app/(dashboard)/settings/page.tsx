import Link from "next/link";
import {
  Globe,
  Key,
  Github,
  Server,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const iconMap: Record<string, LucideIcon> = {
  globe: Globe,
  key: Key,
  github: Github,
  server: Server,
};

const settingsSections = [
  {
    title: "Connection",
    description: "Configure Mac Mini gateway host, port, and auth token",
    href: "/settings/connection",
    icon: "globe",
  },
  {
    title: "Credentials",
    description: "Manage API keys for Anthropic, OpenAI, Google, and more",
    href: "/settings/credentials",
    icon: "key",
  },
  {
    title: "GitHub",
    description: "Personal access token, branch prefix, and PR settings",
    href: "/settings/github",
    icon: "github",
  },
  {
    title: "Gateway",
    description: "OpenClaw gateway config, default model, and thinking level",
    href: "/settings/gateway",
    icon: "server",
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="font-[var(--font-cabin)] text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your OpenClaw dashboard and gateway connection
        </p>
      </div>
      <Separator className="mb-6" />
      <div className="grid gap-3">
        {settingsSections.map((section, index) => {
          const Icon = iconMap[section.icon];
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group animate-fade-in"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-muted/30">
                <CardHeader className="py-4">
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">
                        {section.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        {section.description}
                      </CardDescription>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
