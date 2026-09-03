import {
  BriefingReviewField,
  BriefingReviewSection,
  formatYesNo,
} from "@/components/custom/BriefingReviewField"
import type { BriefingReviewClosingProps } from "./BriefingReviewClosing.types"

export function BriefingReviewClosing({ payload }: BriefingReviewClosingProps) {
  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Considerações finais">
        <BriefingReviewField
          label="Há informação adicional?"
          value={formatYesNo(payload.hasAdditionalInfo)}
        />
        <BriefingReviewField
          label="Detalhes"
          value={payload.additionalInfo}
        />
      </BriefingReviewSection>
    </div>
  )
}
