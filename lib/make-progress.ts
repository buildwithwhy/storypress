// Make-flow progress (wave 7 PR C, background discovery §staged): the pure
// core behind the staged display. Since background discovery, historical
// research is no longer a step the narrator waits on — it runs under the
// conversation and never appears here. The stages cover only the make steps
// the UI genuinely blocks on: the write request and the paper's
// layout/render phase. A stage shows "done" only when its step really ran.
export type MakeStage = "drafting" | "layingOut";
export type MakeStageState = "done" | "active" | "pending" | "skipped";

export const MAKE_STAGES = ["drafting", "layingOut"] as const;

// Live pipeline flags, read from state the UI already tracks: writeActive is
// the write request, layoutActive the paper's layout/render step (including
// follow-up default artwork).
export type MakePipeline = {
  writeActive: boolean;
  layoutActive: boolean;
};

export function makeStageStates(pipeline: MakePipeline): Record<MakeStage, MakeStageState> {
  return {
    drafting: pipeline.writeActive ? "active" : pipeline.layoutActive ? "done" : "pending",
    layingOut: pipeline.layoutActive ? "active" : "pending",
  };
}
