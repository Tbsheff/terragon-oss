"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CronJob, CronSchedule, CronPayload } from "@/lib/openclaw-types";
import { addCronJob, updateCronJob } from "@/server-actions/cron";
import { cronQueryKeys } from "@/queries/cron-queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type CronJobFormProps = {
  onClose: () => void;
  existingJob?: CronJob;
};

export function CronJobForm({ onClose, existingJob }: CronJobFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(existingJob?.name ?? "");
  const [scheduleKind, setScheduleKind] = useState<"cron" | "every" | "at">(
    existingJob?.schedule.kind ?? "every",
  );
  const [cronExpression, setCronExpression] = useState(
    existingJob?.schedule.kind === "cron"
      ? existingJob.schedule.expression
      : "0 9 * * *",
  );
  const [intervalMs, setIntervalMs] = useState(
    existingJob?.schedule.kind === "every"
      ? String(existingJob.schedule.intervalMs / 1000)
      : "3600",
  );
  const [datetime, setDatetime] = useState(
    existingJob?.schedule.kind === "at" ? existingJob.schedule.datetime : "",
  );
  const [sessionTarget, setSessionTarget] = useState<"main" | "isolated">(
    existingJob?.sessionTarget ?? "main",
  );
  const [payloadKind, setPayloadKind] = useState<"agentTurn" | "systemEvent">(
    existingJob?.payload.kind ?? "agentTurn",
  );
  const [message, setMessage] = useState(
    existingJob?.payload.kind === "agentTurn"
      ? existingJob.payload.message
      : "",
  );
  const [event, setEvent] = useState(
    existingJob?.payload.kind === "systemEvent"
      ? existingJob.payload.event
      : "tick",
  );

  const createMut = useMutation({
    mutationFn: async () => {
      let schedule: CronSchedule;
      if (scheduleKind === "cron") {
        schedule = { kind: "cron", expression: cronExpression };
      } else if (scheduleKind === "every") {
        const seconds = Number(intervalMs);
        if (!seconds || seconds <= 0) throw new Error("Invalid interval");
        schedule = { kind: "every", intervalMs: seconds * 1000 };
      } else {
        schedule = { kind: "at", datetime };
      }

      let payload: CronPayload;
      if (payloadKind === "agentTurn") {
        payload = { kind: "agentTurn", message };
      } else {
        payload = { kind: "systemEvent", event };
      }

      const jobData = {
        name,
        enabled: true,
        schedule,
        sessionTarget,
        payload,
      };

      if (existingJob) {
        const result = await updateCronJob(existingJob.jobId, jobData);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      } else {
        const result = await addCronJob(jobData);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cronQueryKeys.list() });
      toast.success(existingJob ? "Cron job updated" : "Cron job created");
      onClose();
    },
    onError: (error) => {
      toast.error(
        existingJob
          ? `Failed to update job: ${error.message}`
          : `Failed to create job: ${error.message}`,
      );
    },
  });

  return (
    <Card className="border-border/60 border-t-2 border-t-primary/20 shadow-xs py-0 animate-fade-in">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="job-name" className="text-xs">
            Name
          </Label>
          <Input
            id="job-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Job name"
            className="bg-muted/20 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Schedule Type</Label>
          <div className="flex gap-2">
            {(["every", "cron", "at"] as const).map((kind) => (
              <Button
                key={kind}
                variant={scheduleKind === kind ? "default" : "outline"}
                size="sm"
                onClick={() => setScheduleKind(kind)}
              >
                {kind === "every" && "Interval"}
                {kind === "cron" && "Cron"}
                {kind === "at" && "One-shot"}
              </Button>
            ))}
          </div>
        </div>

        {scheduleKind === "cron" && (
          <div className="space-y-1.5 animate-fade-in">
            <Label htmlFor="cron-expression" className="text-xs">
              Cron Expression
            </Label>
            <Input
              id="cron-expression"
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="0 9 * * * (9am daily)"
              className="font-mono bg-muted/20 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
        )}

        {scheduleKind === "every" && (
          <div className="space-y-1.5 animate-fade-in">
            <Label htmlFor="interval" className="text-xs">
              Interval (seconds)
            </Label>
            <Input
              id="interval"
              type="number"
              value={intervalMs}
              onChange={(e) => setIntervalMs(e.target.value)}
              placeholder="3600"
              className="font-mono tabular-nums bg-muted/20 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
        )}

        {scheduleKind === "at" && (
          <div className="space-y-1.5 animate-fade-in">
            <Label htmlFor="datetime" className="text-xs">
              Run At (ISO datetime)
            </Label>
            <Input
              id="datetime"
              type="text"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              placeholder="2026-02-15T10:00:00Z"
              className="font-mono tabular-nums bg-muted/20 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Session Target</Label>
          <div className="flex gap-2">
            <Button
              variant={sessionTarget === "main" ? "default" : "outline"}
              size="sm"
              onClick={() => setSessionTarget("main")}
            >
              Main Session
            </Button>
            <Button
              variant={sessionTarget === "isolated" ? "default" : "outline"}
              size="sm"
              onClick={() => setSessionTarget("isolated")}
            >
              Isolated Session
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Payload Type</Label>
          <div className="flex gap-2">
            <Button
              variant={payloadKind === "agentTurn" ? "default" : "outline"}
              size="sm"
              onClick={() => setPayloadKind("agentTurn")}
            >
              Agent Turn
            </Button>
            <Button
              variant={payloadKind === "systemEvent" ? "default" : "outline"}
              size="sm"
              onClick={() => setPayloadKind("systemEvent")}
            >
              System Event
            </Button>
          </div>
        </div>

        {payloadKind === "agentTurn" && (
          <div className="space-y-1.5 animate-fade-in">
            <Label htmlFor="message" className="text-xs">
              Message
            </Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message for the agent"
              rows={3}
              className={cn(
                "w-full rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm",
                "resize-none shadow-xs transition-[color,box-shadow] outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              )}
            />
          </div>
        )}

        {payloadKind === "systemEvent" && (
          <div className="space-y-1.5 animate-fade-in">
            <Label htmlFor="event" className="text-xs">
              Event Name
            </Label>
            <Input
              id="event"
              type="text"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="tick"
              className="bg-muted/20 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={
              !name.trim() ||
              (payloadKind === "agentTurn" && !message.trim()) ||
              createMut.isPending
            }
          >
            {createMut.isPending
              ? existingJob
                ? "Updating..."
                : "Creating..."
              : existingJob
                ? "Update"
                : "Create"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
