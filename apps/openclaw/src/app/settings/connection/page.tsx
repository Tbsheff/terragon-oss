"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import {
  getConnection,
  updateConnection,
  testConnection,
} from "@/server-actions/settings";

export default function ConnectionSettingsPage() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: string;
    version?: string;
    error?: string;
  } | null>(null);

  const { data: connection, isLoading } = useQuery({
    queryKey: ["settings", "connection"],
    queryFn: () => getConnection(),
  });

  const [form, setForm] = useState<{
    host: string;
    port: string;
    authToken: string;
    useTls: boolean;
    maxConcurrentTasks: string;
  } | null>(null);

  // Initialize form from fetched data
  const currentForm = form ?? {
    host: connection?.host ?? "mac-mini.tailnet",
    port: String(connection?.port ?? 18789),
    authToken: connection?.authToken ?? "",
    useTls: connection?.useTls ?? false,
    maxConcurrentTasks: String(connection?.maxConcurrentTasks ?? 5),
  };

  function handleSave() {
    startTransition(async () => {
      try {
        await updateConnection({
          host: currentForm.host,
          port: parseInt(currentForm.port, 10) || 18789,
          authToken: currentForm.authToken || null,
          useTls: currentForm.useTls,
          maxConcurrentTasks: parseInt(currentForm.maxConcurrentTasks, 10) || 5,
        });
        await queryClient.invalidateQueries({
          queryKey: ["settings", "connection"],
        });
        toast.success("Connection settings saved");
      } catch {
        toast.error("Failed to save connection settings");
      }
    });
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection();
      setTestResult(result);
      if (result.success) {
        toast.success(`Connected — ${result.version ?? result.status}`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch {
      setTestResult({ success: false, error: "Test failed unexpectedly" });
      toast.error("Test failed unexpectedly");
    } finally {
      setIsTesting(false);
    }
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
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connection</h1>
          <p className="text-sm text-muted-foreground">
            Configure the Mac Mini gateway connection
          </p>
        </div>
      </div>
      <Separator className="mb-6" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gateway Connection</CardTitle>
            {connection?.lastHealthStatus && (
              <Badge
                variant={
                  connection.lastHealthStatus === "healthy"
                    ? "default"
                    : "destructive"
                }
              >
                {connection.lastHealthStatus === "healthy" ? (
                  <Wifi className="mr-1 size-3" />
                ) : (
                  <WifiOff className="mr-1 size-3" />
                )}
                {connection.lastHealthStatus}
              </Badge>
            )}
          </div>
          <CardDescription>
            Host and authentication for the OpenClaw gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={currentForm.host}
                onChange={(e) =>
                  setForm({ ...currentForm, host: e.target.value })
                }
                placeholder="mac-mini.tailnet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={currentForm.port}
                onChange={(e) =>
                  setForm({ ...currentForm, port: e.target.value })
                }
                placeholder="18789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="authToken">Auth Token</Label>
            <Input
              id="authToken"
              type="password"
              value={currentForm.authToken}
              onChange={(e) =>
                setForm({ ...currentForm, authToken: e.target.value })
              }
              placeholder="Enter gateway auth token"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxConcurrent">Max Concurrent Tasks</Label>
            <Input
              id="maxConcurrent"
              type="number"
              min={1}
              max={20}
              value={currentForm.maxConcurrentTasks}
              onChange={(e) =>
                setForm({
                  ...currentForm,
                  maxConcurrentTasks: e.target.value,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="useTls">Use TLS (wss://)</Label>
            <Switch
              id="useTls"
              checked={currentForm.useTls}
              onCheckedChange={(checked) =>
                setForm({ ...currentForm, useTls: checked })
              }
            />
          </div>

          {testResult && (
            <div
              className={`rounded-md border p-3 text-sm ${
                testResult.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {testResult.success
                ? `Connected successfully. Status: ${testResult.status ?? "ok"}${testResult.version ? `, Version: ${testResult.version}` : ""}`
                : `Connection failed: ${testResult.error}`}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
