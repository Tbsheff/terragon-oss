import { memo } from "react";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";

interface ThinkingPartProps {
  thinking: string;
  isLatest?: boolean;
}

export function getThinkingTitle(thinking: string): string {
  const match = thinking.match(/^\*\*(.*?)\*\*/);
  if (match) {
    return match[1]?.trim() ?? "Thinking";
  }
  return "Thinking";
}

const ThinkingPart = memo(function ThinkingPart({
  thinking,
  isLatest = false,
}: ThinkingPartProps) {
  return (
    <Reasoning defaultOpen={isLatest}>
      <ReasoningTrigger />
      <ReasoningContent>{thinking}</ReasoningContent>
    </Reasoning>
  );
});

export { ThinkingPart };
