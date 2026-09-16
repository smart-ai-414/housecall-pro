import { Check } from "lucide-react";

import { cn } from "@/core/utils/cn";
import {
  INTAKE_STAGES,
  INTAKE_STAGE_LABELS,
  type IntakeStage,
} from "@/modules/intake/progress";

export function ProgressRail({
  stage,
  isComplete,
}: {
  stage: IntakeStage;
  isComplete: boolean;
}) {
  if (isComplete) {
    return (
      <div className="flex items-center gap-2">
        <Check className="size-4 text-white" strokeWidth={2.4} aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-[0.06em] text-white">
          ALL FOUR STEPS COMPLETE
        </span>
      </div>
    );
  }

  const activeIndex = INTAKE_STAGES.indexOf(stage);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-accent-200 text-[11px] font-semibold tracking-[0.06em] uppercase">
          {INTAKE_STAGE_LABELS[stage]}
        </span>
        <span className="text-ink-muted text-[11px] font-semibold tracking-[0.04em]">
          STEP {activeIndex + 1} OF {INTAKE_STAGES.length}
        </span>
      </div>
      <ol className="flex gap-1.5">
        {INTAKE_STAGES.map((candidate, index) => (
          <li
            key={candidate}
            className={cn(
              "h-[3px] flex-1 rounded-full",
              index < activeIndex && "bg-brand-300",
              index === activeIndex && "bg-accent-500",
              index > activeIndex && "bg-brand-800",
            )}
          >
            <span className="sr-only">
              {INTAKE_STAGE_LABELS[candidate]}
              {index < activeIndex ? " — done" : ""}
              {index === activeIndex ? " — in progress" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
