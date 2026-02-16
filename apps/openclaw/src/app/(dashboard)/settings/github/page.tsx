"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Github,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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

import { cn } from "@/lib/utils";
import {
  getSettings,
  updateSettings,
  getGithubAuth,
  updateGithubAuth,
  validateGithubPAT,
} from "@/server-actions/settings";

export default function GitHubSettingsPage() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    username?: string;
    error?: string;
  } | null>(null);

  const { data: githubAuth, isLoading: authLoading } = useQuery({
    queryKey: ["settings", "github-auth"],
    queryFn: () => getGithubAuth(),
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings", "general"],
    queryFn: () => getSettings(),
  });

  const isLoading = authLoading || settingsLoading;

  const [patInput, setPatInput] = useState<string | null>(null);
  const currentPat = patInput ?? githubAuth?.personalAccessToken ?? "";

  const [branchPrefix, setBranchPrefix] = useState<string | null>(null);
  const currentBranchPrefix =
    branchPrefix ?? settingsData?.branchPrefix ?? "openclaw/";

  const [prType, setPrType] = useState<string | null>(null);
  const currentPrType = prType ?? settingsData?.prType ?? "draft";

  const [autoCreatePR, setAutoCreatePR] = useState<boolean | null>(null);
  const currentAutoCreatePR =
    autoCreatePR ?? settingsData?.autoCreatePR ?? true;

  async function handleValidatePAT() {
    if (!currentPat.trim()) {
      toast.error("Enter a PAT first");
      return;
    }
    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await validateGithubPAT(currentPat.trim());
      setValidationResult(result);
      if (result.valid) {
        toast.success(`Authenticated as ${result.username}`);
      } else {
        toast.error(`Validation failed: ${result.error}`);
      }
    } catch {
      toast.error("Validation failed");
    } finally {
      setIsValidating(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        // Save PAT
        const username =
          validationResult?.username ?? githubAuth?.username ?? null;
        await updateGithubAuth({
          personalAccessToken: currentPat.trim() || null,
          username,
        });

        // Save settings
        await updateSettings({
          branchPrefix: currentBranchPrefix,
          prType: currentPrType as "draft" | "ready",
          autoCreatePR: currentAutoCreatePR,
        });

        await queryClient.invalidateQueries({
          queryKey: ["settings"],
        });
        toast.success("GitHub settings saved");
      } catch {
        toast.error("Failed to save GitHub settings");
      }
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-6">
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <Skeleton className="h-[260px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings">
              <Button variant="ghost" size="icon" aria-label="Back to settings">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to settings</TooltipContent>
        </Tooltip>
        <div>
          <h1 className="font-[var(--font-cabin)] text-2xl font-bold tracking-tight text-balance">
            GitHub
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Configure GitHub integration and PR settings
          </p>
        </div>
      </div>
      <Separator className="mb-6" />

      <div className="space-y-6">
        {/* PAT Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Personal Access Token</CardTitle>
                <CardDescription>
                  Used for branch creation, commits, and PR management
                </CardDescription>
              </div>
              {githubAuth?.username && (
                <Badge variant="outline">
                  <Github className="mr-1 size-3" />
                  {githubAuth.username}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pat">GitHub PAT</Label>
              <div className="flex gap-2">
                <Input
                  id="pat"
                  type="password"
                  value={currentPat}
                  onChange={(e) => setPatInput(e.target.value)}
                  placeholder="ghp_..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleValidatePAT}
                  disabled={isValidating}
                >
                  {isValidating && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Validate
                </Button>
              </div>
            </div>

            {validationResult && (
              <div
                className={cn(
                  "animate-fade-in flex items-center gap-2 rounded-md border p-3 text-sm",
                  validationResult.valid
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400",
                )}
              >
                {validationResult.valid ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Authenticated as{" "}
                    <span className="font-medium">
                      {validationResult.username}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-4" />
                    {validationResult.error}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PR Settings Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Pull Request Settings</CardTitle>
            <CardDescription>
              Configure how PRs are created by agents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branchPrefix">Branch Prefix</Label>
              <Input
                id="branchPrefix"
                value={currentBranchPrefix}
                onChange={(e) => setBranchPrefix(e.target.value)}
                placeholder="openclaw/"
              />
              <p className="text-xs text-muted-foreground">
                Prefix for auto-created branches (e.g. openclaw/fix-bug-123)
              </p>
            </div>

            <div className="space-y-2">
              <Label>PR Type</Label>
              <Select value={currentPrType} onValueChange={(v) => setPrType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft PR</SelectItem>
                  <SelectItem value="ready">Ready for Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoCreate">Auto-create PR</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically create a PR when agent pushes commits
                </p>
              </div>
              <Switch
                id="autoCreate"
                checked={currentAutoCreatePR}
                onCheckedChange={(checked) => setAutoCreatePR(checked)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
