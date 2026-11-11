"use client";
// Make-flow progress (wave 7 PR C): the three-stage display that replaces the
// single static busy message. States come from makeStageStates — real
// pipeline steps, never a timer — and an active stage pulses gently instead
// of showing a bare spinner.
import { Check, Minus } from "lucide-react";
import { MAKE_STAGES, makeStageStates, type MakePipeline } from "../lib/make-progress";
import { presentation } from "../lib/presentation";
import type { Story } from "../lib/story";

export function MakeProgress({ language, pipeline }: { language: Story["language"]; pipeline: MakePipeline }) {
  const copy = presentation[language].makeProgress;
  const states = makeStageStates(pipeline);
  return (
    <div className="make-progress no-print" role="status" aria-live="polite">
      <p className="make-progress-title">{copy.title}</p>
      <ol className="make-stages">
        {MAKE_STAGES.map((stage) => {
          const state = states[stage];
          return (
            <li key={stage} className={`make-stage is-${state}`}>
              <span className="make-stage-mark" aria-hidden="true">{state === "done" ? <Check size={12}/> : state === "skipped" ? <Minus size={12}/> : <span className="make-stage-dot"/>}</span>
              <span className="make-stage-text">{copy[stage]}{stage === "researching" && state === "skipped" && <span className="make-stage-note">{copy.researchSkipped}</span>}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
