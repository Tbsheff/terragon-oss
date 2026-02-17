"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  threadDetailQueryOptions,
  threadMessagesQueryOptions,
} from "@/queries/thread-queries";
import { toUIMessages } from "@/components/chat/toUIMessages";
import { openClawHistoryToDBMessages } from "@/lib/message-adapter";
import type { DBMessage, ThreadStatus, UIMessage } from "@/lib/types";
import { useRealtimeThread } from "@/hooks/use-realtime";

const MAX_CONDENSED_MESSAGES = 5;

function getMessageSummary(msg: UIMessage): string | null {
  if (msg.role === "user") {
    for (const part of msg.parts) {
      if (part.type === "text") return part.text;
    }
    return "User message";
  }

  if (msg.role === "agent") {
    for (const part of msg.parts) {
      if (part.type === "text") return part.text;
      if (part.type === "tool") {
        const params = part.parameters;
        if (part.name === "Bash" && "command" in params) {
          return `$ ${(params as { command: string }).command.slice(0, 80)}`;
        }
        if (part.name === "Read" && "file_path" in params) {
          return `Read ${(params as { file_path: string }).file_path}`;
        }
        if (part.name === "Write" && "file_path" in params) {
          return `Write ${(params as { file_path: string }).file_path}`;
        }
        if (part.name === "Edit" && "file_path" in params) {
          return `Edit ${(params as { file_path: string }).file_path}`;
        }
        return `Tool: ${part.name}`;
      }
    }
    return "Agent response";
  }

  if (msg.role === "system") {
    return `System: ${msg.message_type}`;
  }

  return null;
}

type CondensedChatViewProps = {
  threadId: string;
};

export function CondensedChatView({ threadId }: CondensedChatViewProps) {
  useRealtimeThread(threadId);

  const { data: threadDetail } = useQuery(threadDetailQueryOptions(threadId));
  const { data: historyData } = useQuery(threadMessagesQueryOptions(threadId));

  const dbMessages = useMemo((): DBMessage[] => {
    if (!historyData?.ok || !historyData.data.length) return [];
    return openClawHistoryToDBMessages(
      historyData.data,
    ) as unknown as DBMessage[];
  }, [historyData]);

  const uiMessages = useMemo(
    () =>
      toUIMessages({
        dbMessages,
        agent: threadDetail?.agent ?? "unknown",
        threadStatus: (threadDetail?.status as ThreadStatus) ?? null,
      }),
    [dbMessages, threadDetail?.status],
  );

  const recentMessages = uiMessages.slice(-MAX_CONDENSED_MESSAGES);

  const isWorking =
    threadDetail?.status === "working" || threadDetail?.status === "stopping";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {recentMessages.length === 0 && !isWorking && (
          <p className="text-[11px] text-muted-foreground/60 text-center text-pretty py-4">
            No messages yet
          </p>
        )}

        {recentMessages.map((msg, i) => {
          const summary = getMessageSummary(msg);
          if (!summary) return null;

          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              className="animate-fade-in flex gap-1.5 items-start"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase mt-0.5 w-8 shrink-0">
                {isUser ? "You" : "AI"}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 break-all">
                {summary.slice(0, 200)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Activity indicator */}
      <div className="border-t border-border/60 px-3 py-1.5 bg-card/80 backdrop-blur">
        {isWorking ? (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-primary font-medium">
              Agent is working...
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground" />
            <span className="text-[10px] text-muted-foreground/60">Idle</span>
          </div>
        )}
      </div>
    </div>
  );
}
