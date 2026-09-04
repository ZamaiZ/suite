import type { BriefingStepId } from "@/lib/briefing/steps"

export function briefingStepsToInvalidateAfterStaffEdit(
  step: BriefingStepId,
): BriefingStepId[] {
  if (step === "company") return ["company", "audience"]
  if (step === "brand") return ["brand", "finance"]
  return [step]
}
