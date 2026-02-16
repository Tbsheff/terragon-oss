import { AgentDetailView } from "@/components/agents/agent-detail-view";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AgentDetailView agentId={id} />
    </div>
  );
}
