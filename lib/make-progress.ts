// Make-flow progress (wave 7 PR C): the pure core behind the three-stage
// display that replaces the single static busy message. The stages mirror the
// client-orchestrated pipeline steps — discover, write, layout/render — so the
// display only ever reports work the backend actually performs: a stage shows
// "done" only when its step really ran, and "skipped" when it never will.
export type MakeStage = "researching" | "drafting" | "layingOut";
export type MakeStageState = "done" | "active" | "pending" | "skipped";

export const MAKE_STAGES = ["researching", "drafting", "layingOut"] as const;

// Live pipeline flags, read from state the UI already tracks: researchActive
// is a discover request in flight, researchDone a finished one (curated
// sources or a settled search), writeActive the write request, layoutActive
// the paper's layout/render step (including follow-up default artwork).
export type MakePipeline = {
  researchActive: boolean;
  researchDone: boolean;
  writeActive: boolean;
  layoutActive: boolean;
};

export function makeStageStates(pipeline: MakePipeline): Record<MakeStage, MakeStageState> {
  return {
    researching: pipeline.researchActive ? "active" : pipeline.researchDone ? "done" : "skipped",
    drafting: pipeline.writeActive ? "active" : pipeline.layoutActive ? "done" : "pending",
    layingOut: pipeline.layoutActive ? "active" : "pending",
  };
}
