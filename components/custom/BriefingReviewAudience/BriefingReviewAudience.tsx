import {
  BriefingReviewChips,
  BriefingReviewField,
  BriefingReviewSection,
} from "@/components/custom/BriefingReviewField"
import {
  PERSONA_AGE_RANGE_LABELS,
  PERSONA_INCOME_RANGE_LABELS,
  PERSONA_SEX_LABELS,
} from "@/lib/briefing/audience"
import type { BriefingReviewAudienceProps } from "./BriefingReviewAudience.types"

export function BriefingReviewAudience({
  payload,
}: BriefingReviewAudienceProps) {
  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Persona">
        <BriefingReviewChips
          label="Faixas etárias"
          items={payload.personaAgeRanges.map(
            (id) => PERSONA_AGE_RANGE_LABELS[id] ?? id,
          )}
        />
        <BriefingReviewField
          label="Sexo"
          value={
            payload.personaSex
              ? PERSONA_SEX_LABELS[payload.personaSex]
              : ""
          }
        />
        <BriefingReviewField label="Cidade" value={payload.personaCity} />
        <BriefingReviewField
          label="Profissão"
          value={payload.personaProfession}
        />
        <BriefingReviewChips
          label="Renda"
          items={payload.personaIncomeRanges.map(
            (id) => PERSONA_INCOME_RANGE_LABELS[id] ?? id,
          )}
        />
        <BriefingReviewChips label="Dores" items={payload.personaPains} />
        <BriefingReviewChips
          label="Comportamentos"
          items={payload.personaBehaviors}
        />
        <BriefingReviewField
          label="Objeções"
          value={payload.personaObjections}
        />
        <BriefingReviewField label="Traços" value={payload.personaTraits} />
        <BriefingReviewField label="Tom de voz" value={payload.voiceTone} />
      </BriefingReviewSection>
      <BriefingReviewSection title="Atuação">
        <BriefingReviewField
          label="Raio de atendimento"
          value={
            payload.serviceRadiusNotApplicable
              ? "Não se aplica"
              : `${payload.serviceRadiusKm} km`
          }
        />
        <BriefingReviewChips
          label="Bairros"
          items={payload.targetNeighborhoods}
        />
        <BriefingReviewChips label="Cidades" items={payload.targetCities} />
        <BriefingReviewField
          label="Região prioritária"
          value={payload.priorityRegion}
        />
        <BriefingReviewChips label="Keywords" items={payload.keywords} />
        <BriefingReviewField
          label="Keyword principal"
          value={payload.primaryKeyword}
        />
      </BriefingReviewSection>
    </div>
  )
}
