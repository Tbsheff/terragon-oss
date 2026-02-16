import { ParallelViewShell } from "@/components/parallel/parallel-view-shell";
import type { LayoutMode } from "@/components/parallel/parallel-layout-provider";

const VALID_LAYOUTS: LayoutMode[] = ["focus", "split", "grid"];

export default async function ParallelPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; layout?: string; active?: string }>;
}) {
  const params = await searchParams;

  const ids = params.ids ? params.ids.split(",").filter(Boolean) : [];

  const layout: LayoutMode = VALID_LAYOUTS.includes(params.layout as LayoutMode)
    ? (params.layout as LayoutMode)
    : "split";

  const active = params.active ?? null;

  return (
    <ParallelViewShell
      initialIds={ids}
      initialLayout={layout}
      initialActive={active}
    />
  );
}
