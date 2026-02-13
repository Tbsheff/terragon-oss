import Link from "next/link";
import { Globe, Key, Github, Server, type LucideIcon } from "lucide-react";
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
      <div className="grid gap-4">
        {settingsSections.map((section, index) => {
          const Icon = iconMap[section.icon];
          return (
            <Link
              key={section.href}
              href={section.href}
              className="animate-fade-in opacity-0 [animation-fill-mode:forwards]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Card className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-muted/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className="size-5 text-muted-foreground" />}
                    <div>
                      <CardTitle className="text-base">
                        {section.title}
                      </CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
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
