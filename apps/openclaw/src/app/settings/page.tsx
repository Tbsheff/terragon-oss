import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your OpenClaw dashboard and gateway connection
        </p>
      </div>
      <Separator className="mb-6" />
      <div className="grid gap-4">
        {settingsSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="transition-colors hover:bg-muted/30 cursor-pointer">
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
