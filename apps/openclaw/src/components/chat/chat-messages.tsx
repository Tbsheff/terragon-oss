import { memo } from "react";
import type { UIMessage } from "@/lib/types";
import { ChatMessageWithToolbar } from "./chat-message";
import { LeafLoading } from "./leaf-loading";

export const ChatMessages = memo(function ChatMessages({
  messages,
  isAgentWorking,
}: {
  messages: UIMessage[];
  isAgentWorking: boolean;
}) {
  // Find the latest agent message
  let latestAgentMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "agent") {
      latestAgentMessageIndex = i;
      break;
    }
  }

  return (
    <>
      {messages.map((message: UIMessage, index: number) => {
        const isLatestMessage = index === messages.length - 1;
        const isFirstUserMessage = index === 0 && message.role === "user";
        const isLatestAgentMessage =
          message.role === "agent" && index === latestAgentMessageIndex;
        return (
          <ChatMessageWithToolbar
            key={index}
            message={message}
            messageIndex={index}
            isAgentWorking={isAgentWorking}
            isLatestMessage={isLatestMessage}
            isFirstUserMessage={isFirstUserMessage}
            isLatestAgentMessage={isLatestAgentMessage}
          />
        );
      })}
    </>
  );
});

export function WorkingMessage({
  message = "Working...",
}: {
  message?: string | React.ReactNode;
}) {
  return <LeafLoading message={message} />;
}
