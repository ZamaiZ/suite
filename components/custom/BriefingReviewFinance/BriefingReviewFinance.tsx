import {
  BriefingReviewField,
  BriefingReviewSection,
} from "@/components/custom/BriefingReviewField"
import {
  REVENUE_RANGE_LABELS,
  SEASONALITY_PROFILE_LABELS,
} from "@/lib/briefing/finance"
import type { BriefingReviewFinanceProps } from "./BriefingReviewFinance.types"

export function BriefingReviewFinance({
  payload,
  productName,
  serviceName,
}: BriefingReviewFinanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Faturamento">
        <BriefingReviewField
          label="Receita mensal"
          value={
            payload.monthlyRevenueRange
              ? REVENUE_RANGE_LABELS[payload.monthlyRevenueRange]
              : ""
          }
        />
        <BriefingReviewField
          label="Pico de receita"
          value={
            payload.peakRevenueRange
              ? REVENUE_RANGE_LABELS[payload.peakRevenueRange]
              : ""
          }
        />
        <BriefingReviewField
          label="Motivo do pico"
          value={payload.peakRevenueReason}
        />
        <BriefingReviewField
          label="Ticket médio"
          value={
            payload.averageTicketRange
              ? REVENUE_RANGE_LABELS[payload.averageTicketRange]
              : ""
          }
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Sazonalidade">
        <BriefingReviewField
          label="Perfil"
          value={
            payload.seasonalityProfile
              ? SEASONALITY_PROFILE_LABELS[payload.seasonalityProfile]
              : ""
          }
        />
        <BriefingReviewField
          label="Notas"
          value={payload.seasonalityNotes}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Maior lucratividade">
        <BriefingReviewField
          label="Produto"
          value={productName ?? (payload.highestProfitProductId ? "Selecionado" : "")}
        />
        <BriefingReviewField
          label="Serviço"
          value={serviceName ?? (payload.highestProfitServiceId ? "Selecionado" : "")}
        />
      </BriefingReviewSection>
    </div>
  )
}
