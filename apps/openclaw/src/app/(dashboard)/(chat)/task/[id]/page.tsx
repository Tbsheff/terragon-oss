import { OpenClawChatUI } from "@/components/chat/openclaw-chat-ui";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OpenClawChatUI threadId={id} />;
}
