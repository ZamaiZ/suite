import {
  BriefingReviewChips,
  BriefingReviewField,
  BriefingReviewSection,
  formatYesNo,
} from "@/components/custom/BriefingReviewField"
import { MARKETING_TOOL_LABELS } from "@/lib/briefing/marketing-tools"
import type { BriefingReviewBrandProps } from "./BriefingReviewBrand.types"

function teamLabel(hasTeam: "yes" | "no" | null): string {
  return formatYesNo(hasTeam)
}

export function BriefingReviewBrand({ payload }: BriefingReviewBrandProps) {
  const tools = payload.noneMarketingTools
    ? ["Nenhuma"]
    : [
        ...payload.marketingTools.map((id) => MARKETING_TOOL_LABELS[id] ?? id),
        ...payload.otherMarketingTools,
      ]

  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Marca">
        <BriefingReviewField
          label="Processo de vendas"
          value={payload.salesProcess}
        />
        <BriefingReviewField
          label="História da empresa"
          value={payload.companyStory}
        />
        <BriefingReviewField
          label="Como atraem clientes"
          value={payload.customerAttraction}
        />
        <BriefingReviewField label="Desafios" value={payload.challenges} />
      </BriefingReviewSection>
      <BriefingReviewSection title="Produtos e serviços">
        {payload.productsAndServices.length === 0 ? (
          <BriefingReviewField label="Itens" value="" />
        ) : (
          payload.productsAndServices.map((item) => (
            <BriefingReviewField
              key={item.id}
              label={`${item.kind === "product" ? "Produto" : "Serviço"} · ${item.name || "Sem nome"}`}
              value={item.description}
            />
          ))
        )}
      </BriefingReviewSection>
      <BriefingReviewSection title="Time">
        <BriefingReviewField
          label="Time comercial"
          value={`${teamLabel(payload.commercialTeam.hasTeam)}${payload.commercialTeam.notes ? ` · ${payload.commercialTeam.notes}` : ""}`}
        />
        <BriefingReviewField
          label="Desenvolvimento de site"
          value={`${teamLabel(payload.websiteDeveloper.hasTeam)}${payload.websiteDeveloper.notes ? ` · ${payload.websiteDeveloper.notes}` : ""}`}
        />
        <BriefingReviewField
          label="Produção de conteúdo"
          value={`${teamLabel(payload.contentProduction.hasTeam)}${payload.contentProduction.notes ? ` · ${payload.contentProduction.notes}` : ""}`}
        />
      </BriefingReviewSection>
      <BriefingReviewChips label="Ferramentas de marketing" items={tools} />
      <BriefingReviewSection title="Concorrência">
        <BriefingReviewField
          label="Vantagens"
          value={payload.competitiveAdvantages}
        />
        <BriefingReviewField
          label="Pontos fracos"
          value={payload.competitiveWeaknesses}
        />
        <BriefingReviewChips label="Concorrentes" items={payload.competitors} />
      </BriefingReviewSection>
    </div>
  )
}
