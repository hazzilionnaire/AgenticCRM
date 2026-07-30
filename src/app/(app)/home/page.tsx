import { listNeedsAttention } from "@/server/companies/attention";
import { listPipeline } from "@/server/companies/pipeline";
import { listReps } from "@/server/reference/service";
import { NeedsAttention } from "@/components/pipeline/needs-attention";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ cards, capped }, reps, attention] = await Promise.all([
    listPipeline(),
    listReps(),
    listNeedsAttention(),
  ]);

  return (
    <div className="space-y-4">
      <NeedsAttention items={attention} />
      <PipelineBoard cards={cards} reps={reps} capped={capped} />
    </div>
  );
}
