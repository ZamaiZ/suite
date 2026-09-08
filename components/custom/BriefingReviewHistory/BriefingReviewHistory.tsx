import {
  BriefingReviewField,
  BriefingReviewSection,
  formatYesNo,
} from "@/components/custom/BriefingReviewField"
import type { BriefingReviewHistoryProps } from "./BriefingReviewHistory.types"

export function BriefingReviewHistory({ payload }: BriefingReviewHistoryProps) {
  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Histórico">
        <BriefingReviewField
          label="Já investiu em marketing?"
          value={formatYesNo(payload.hasMarketingInvestment)}
        />
        <BriefingReviewField label="Canais" value={payload.marketingChannels} />
        <BriefingReviewField
          label="Resultados"
          value={payload.marketingResults}
        />
        <BriefingReviewField
          label="Insatisfação com fornecedor?"
          value={formatYesNo(payload.hasProviderDissatisfaction)}
        />
        <BriefingReviewField
          label="Detalhes da insatisfação"
          value={payload.providerDissatisfactionNotes}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Metas">
        <BriefingReviewField
          label="Objetivos do projeto"
          value={payload.projectGoals}
        />
        <BriefingReviewField
          label="Critérios de NPS 10"
          value={payload.npsTenCriteria}
        />
      </BriefingReviewSection>
    </div>
  )
}
