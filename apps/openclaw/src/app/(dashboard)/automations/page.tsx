"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  removeCronJob,
  updateCronJob,
  runCronJob,
} from "@/server-actions/cron";
import { cronListQueryOptions, cronQueryKeys } from "@/queries/cron-queries";
import { cn } from "@/lib/utils";
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Power,
  PowerOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CronJobForm } from "@/components/cron/cron-job-form";

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);

  const { data: jobsResult, isLoading } = useQuery(cronListQueryOptions());

  const jobs = jobsResult?.ok ? jobsResult.data : [];
  const error = jobsResult?.ok === false ? jobsResult.error : null;

  const toggleMut = useMutation({
    mutationFn: ({ jobId, enabled }: { jobId: string; enabled: boolean }) =>
      updateCronJob(jobId, { enabled }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: cronQueryKeys.all });
        toast.success(result.data.enabled ? "Job enabled" : "Job disabled");
      } else {
        toast.error(`Failed to toggle job: ${result.error}`);
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: removeCronJob,
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: cronQueryKeys.all });
        toast.success("Job deleted");
        setDeleteJobId(null);
      } else {
        toast.error(`Failed to delete job: ${result.error}`);
      }
    },
  });

  const runMut = useMutation({
    mutationFn: runCronJob,
    onSuccess: (result, jobId) => {
      if (result.ok) {
        toast.success(`Job started: run ${result.data.runId}`);
      } else {
        toast.error(`Failed to run job: ${result.error}`);
      }
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-balance font-[var(--font-cabin)]">
              Cron Jobs
            </h1>
            <p className="text-xs text-pretty text-muted-foreground mt-0.5">
              Gateway-managed scheduled tasks
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="size-3.5" />
            New Job
          </Button>
        </div>
      </div>
      <Separator />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {showCreate && <CronJobForm onClose={() => setShowCreate(false)} />}

        {isLoading && (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="py-0 animate-pulse border-border/60 shadow-xs"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 size-7 rounded-md bg-muted" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-muted" />
                        <div className="h-3 w-48 rounded bg-muted" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="size-7 rounded-md bg-muted" />
                      <div className="size-7 rounded-md bg-muted" />
                      <div className="size-7 rounded-md bg-muted" />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-5 w-14 rounded-full bg-muted" />
                    <div className="h-5 w-20 rounded-full bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="animate-fade-in border-destructive/50 bg-destructive/5 shadow-xs">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-6 text-destructive" />
              </div>
              <p className="mt-3 text-sm font-medium text-balance text-foreground">
                Gateway disconnected
              </p>
              <p className="mt-1 text-xs text-pretty text-muted-foreground/60 max-w-[280px] text-center">
                {error}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && jobs.length === 0 && !showCreate && (
          <Card className="animate-fade-in border-dashed border-border/60 shadow-xs">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Clock className="size-6 text-primary/60" />
              </div>
              <p className="mt-3 text-sm font-medium text-balance text-foreground">
                No cron jobs yet
              </p>
              <p className="mt-1 text-xs text-pretty text-muted-foreground/60 max-w-[280px] text-center">
                Create a job to run tasks on a schedule
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="size-3.5" />
                New Job
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && jobs.length > 0 && (
          <div className="grid gap-3">
            {jobs.map((job, index) => {
              let scheduleText = "";
              if (job.schedule.kind === "cron") {
                scheduleText = job.schedule.expression;
              } else if (job.schedule.kind === "every") {
                const seconds = Number(job.schedule.intervalMs) / 1000;
                if (Number.isNaN(seconds) || seconds <= 0) {
                  scheduleText = "Invalid interval";
                } else if (seconds < 60) {
                  scheduleText = `Every ${seconds}s`;
                } else if (seconds < 3600) {
                  scheduleText = `Every ${Math.floor(seconds / 60)}m`;
                } else {
                  scheduleText = `Every ${Math.floor(seconds / 3600)}h`;
                }
              } else {
                scheduleText = `At ${job.schedule.datetime}`;
              }

              return (
                <Card
                  key={job.jobId}
                  className={cn(
                    "py-0 transition-all duration-200 animate-fade-in border-border/60 shadow-xs border-t-2 border-t-primary/20",
                    job.enabled
                      ? "hover:shadow-md hover:-translate-y-0.5"
                      : "opacity-50 border-dashed bg-muted/20",
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "mt-0.5 flex size-7 items-center justify-center rounded-md",
                            job.enabled
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Clock className="size-3.5" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium tracking-tight font-[var(--font-cabin)] truncate">
                            {job.name}
                          </h3>
                          <p className="mt-0.5 text-xs text-pretty text-muted-foreground font-mono tabular-nums line-clamp-1">
                            {job.payload.kind === "agentTurn"
                              ? job.payload.message.slice(0, 80)
                              : `Event: ${job.payload.event}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Run job now"
                              className="size-7 text-muted-foreground hover:text-primary"
                              onClick={() => runMut.mutate(job.jobId)}
                              disabled={
                                runMut.isPending &&
                                runMut.variables === job.jobId
                              }
                            >
                              {runMut.isPending &&
                              runMut.variables === job.jobId ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Play className="size-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Run now</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={
                                job.enabled ? "Disable job" : "Enable job"
                              }
                              className={cn(
                                "size-7",
                                job.enabled
                                  ? "text-primary hover:bg-primary/10"
                                  : "text-muted-foreground hover:bg-muted",
                              )}
                              onClick={() =>
                                toggleMut.mutate({
                                  jobId: job.jobId,
                                  enabled: !job.enabled,
                                })
                              }
                            >
                              {job.enabled ? (
                                <Power className="size-3.5" />
                              ) : (
                                <PowerOff className="size-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {job.enabled ? "Disable" : "Enable"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete job"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteJobId(job.jobId)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete job</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono text-xs tabular-nums bg-muted/50 border-border/60"
                      >
                        {scheduleText}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-muted/50 border-border/60"
                      >
                        {job.sessionTarget}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-muted/50 border-border/60"
                      >
                        {job.payload.kind}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={deleteJobId !== null}
        onOpenChange={(open) => !open && setDeleteJobId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-balance">Delete cron job?</DialogTitle>
            <DialogDescription className="text-pretty">
              This action cannot be undone. The job will be permanently deleted
              from the gateway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteJobId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteJobId && deleteMut.mutate(deleteJobId)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
