import { listPipeline } from "@/server/companies/pipeline";
import { listReps } from "@/server/reference/service";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [{ cards, capped }, reps] = await Promise.all([listPipeline(), listReps()]);

  return <PipelineBoard cards={cards} reps={reps} capped={capped} />;
}
