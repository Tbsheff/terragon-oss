"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  getGatewayConfig,
  updateGatewayConfig,
} from "@/server-actions/gateway";

const modelOptions = [
  { value: "sonnet", label: "Claude Sonnet" },
  { value: "opus", label: "Claude Opus" },
  { value: "haiku", label: "Claude Haiku" },
] as const;

const thinkingOptions = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export default function GatewaySettingsPage() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  const {
    data: configResult,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["settings", "gateway-config"],
    queryFn: () => getGatewayConfig(),
  });

  const config = configResult?.config;
  const configError = configResult?.error;

  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const currentModel =
    defaultModel ??
    (config?.["defaultModel"] as string | undefined) ??
    "sonnet";

  const [thinking, setThinking] = useState<string | null>(null);
  const currentThinking =
    thinking ?? (config?.["thinking"] as string | undefined) ?? "off";

  function handleSave() {
    startTransition(async () => {
      try {
        if (showRawJson) {
          // Parse and patch raw JSON
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonInput);
          } catch {
            toast.error("Invalid JSON");
            return;
          }
          const result = await updateGatewayConfig(parsed);
          if (!result.success) {
            toast.error(`Failed: ${result.error}`);
            return;
          }
        } else {
          const result = await updateGatewayConfig({
            defaultModel: currentModel,
            thinking: currentThinking,
          });
          if (!result.success) {
            toast.error(`Failed: ${result.error}`);
            return;
          }
        }

        await queryClient.invalidateQueries({
          queryKey: ["settings", "gateway-config"],
        });
        toast.success("Gateway config updated");
      } catch {
        toast.error("Failed to update gateway config");
      }
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to settings</TooltipContent>
        </Tooltip>
        <div>
          <h1 className="font-[var(--font-cabin)] text-2xl font-bold tracking-tight">
            Gateway Config
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the OpenClaw gateway runtime settings
          </p>
        </div>
      </div>
      <Separator className="mb-6" />

      {configError || isError ? (
        <Card className="animate-fade-in">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Server className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Unable to connect to gateway
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {configError ?? "Check your connection settings"}
              </p>
              <Link href="/settings/connection" className="mt-3">
                <Button variant="outline" size="sm">
                  Configure Connection
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Runtime Settings</CardTitle>
                  <CardDescription>
                    Default model and thinking configuration
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!showRawJson && config) {
                      setJsonInput(JSON.stringify(config, null, 2));
                    }
                    setShowRawJson(!showRawJson);
                  }}
                >
                  {showRawJson ? "Form View" : "JSON View"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showRawJson ? (
                <div className="space-y-2">
                  <Label htmlFor="jsonConfig">Config JSON</Label>
                  <textarea
                    id="jsonConfig"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Default Model</Label>
                    <Select
                      value={currentModel}
                      onValueChange={(v) => setDefaultModel(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Thinking Level</Label>
                    <Select
                      value={currentThinking}
                      onValueChange={(v) => setThinking(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {thinkingOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Controls extended thinking for Claude models
                    </p>
                  </div>

                  {config && (
                    <div className="space-y-2">
                      <Label>Current Config</Label>
                      <pre className="overflow-auto rounded-md border bg-muted/30 p-3 text-xs font-mono max-h-[200px]">
                        {JSON.stringify(config, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
