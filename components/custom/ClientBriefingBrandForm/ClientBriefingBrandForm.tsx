"use client"

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ComponentType,
} from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiAddCircleLine,
  RiBarChartBoxLine,
  RiCheckLine,
  RiCloseLine,
  RiCustomerService2Line,
  RiDatabase2Line,
  RiErrorWarningLine,
  RiFireLine,
  RiForbidLine,
  RiGoogleLine,
  RiHistoryLine,
  RiMailSendLine,
  RiMegaphoneLine,
  RiMetaLine,
  RiRobot2Line,
  RiSearchEyeLine,
  RiSwordLine,
  RiTeamLine,
  RiToolsLine,
  RiWhatsappLine,
} from "react-icons/ri"
import {
  completeBriefingBrand,
  saveBriefingBrand,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingCatalogEditor } from "@/components/custom/BriefingCatalogEditor"
import { BriefingChipField } from "@/components/custom/BriefingChipField"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import {
  attachBriefingClientId,
  useBriefingWriterClientId,
  useBriefingWriterFlushRegistration,
  useWrappedBriefingSave,
} from "@/components/custom/BriefingWriter"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { BriefingTextareaField } from "@/components/custom/BriefingFormControls/BriefingFormControls"
import { Textarea } from "@/components/ui/textarea"
import {
  BRAND_MISSING_LABELS,
  getBrandMissingGroups,
  isBrandReadyToComplete,
  type BriefingBrandPayload,
  type TeamHasAnswer,
  type TeamRoleAnswer,
} from "@/lib/briefing/brand"
import {
  MARKETING_TOOL_IDS,
  MARKETING_TOOL_LABELS,
  type MarketingToolId,
} from "@/lib/briefing/marketing-tools"
import { cn } from "cn"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingBrandFormProps } from "./ClientBriefingBrandForm.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const TOOL_ICONS: Record<
  MarketingToolId,
  ComponentType<{ size?: number; className?: string }>
> = {
  google_ads: RiGoogleLine,
  meta_ads: RiMetaLine,
  crm: RiDatabase2Line,
  email_marketing: RiMailSendLine,
  heatmap: RiFireLine,
  chatbot: RiRobot2Line,
  whatsapp_business: RiWhatsappLine,
  automation: RiToolsLine,
  seo: RiSearchEyeLine,
  analytics: RiBarChartBoxLine,
}

function TeamRoleBlock({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: TeamRoleAnswer
  onChange: (next: TeamRoleAnswer) => void
}) {
  return (
    <Card size="sm" className="bg-popover p-3.5">
      <FieldSet>
        <FieldLegend variant="label">{label}</FieldLegend>
        <RadioGroup
          className="flex flex-row flex-wrap items-center gap-3"
          value={value.hasTeam ?? ""}
          onValueChange={(next) =>
            onChange({
              ...value,
              hasTeam: next as TeamHasAnswer,
            })
          }
        >
          <Field orientation="horizontal" className="w-auto">
            <RadioGroupItem id={`${id}-yes`} value="yes" />
            <FieldLabel htmlFor={`${id}-yes`}>Sim</FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <RadioGroupItem id={`${id}-no`} value="no" />
            <FieldLabel htmlFor={`${id}-no`}>Não</FieldLabel>
          </Field>
        </RadioGroup>
      </FieldSet>
      <div className="mt-3">
        <Field>
          <FieldLabel htmlFor={`${id}-notes`}>
            Como a função é realizada
          </FieldLabel>
          <Textarea
            id={`${id}-notes`}
            rows={3}
            value={value.notes}
            onChange={(event) =>
              onChange({ ...value, notes: event.target.value })
            }
            placeholder="Explique brevemente"
          />
        </Field>
      </div>
    </Card>
  )
}

export function ClientBriefingBrandForm({
  initialPayload,
  initialUpdatedAt,
  initialCompletedAt,
  variant = "portal",
  onBack,
  onContinue,
}: ClientBriefingBrandFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingBrand)
  const reduced = !!useReducedMotion()
  const [payload, setPayload] = useState<BriefingBrandPayload>(initialPayload)
  const [showOtherTools, setShowOtherTools] = useState(
    initialPayload.otherMarketingTools.length > 0,
  )
  const [isCompleting, startComplete] = useTransition()

  const {
    saveState,
    savedAt,
    completedAt,
    errorMessage,
    scheduleSave,
    flushPending,
    markComplete,
    setError,
    clearError,
  } = useBriefingAutosave(initialUpdatedAt, initialCompletedAt, persist)
  useBriefingWriterFlushRegistration(flushPending)

  const patch = useCallback(
    (partial: Partial<BriefingBrandPayload>) => {
      setPayload((current) => {
        const next = { ...current, ...partial }
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  const ready = isBrandReadyToComplete(payload)
  const missingLabels = useMemo(
    () =>
      getBrandMissingGroups(payload).map(
        (group) => BRAND_MISSING_LABELS[group],
      ),
    [payload],
  )
  const completed = Boolean(completedAt)

  function toggleTool(id: MarketingToolId, checked: boolean) {
    const marketingTools = checked
      ? [...payload.marketingTools.filter((item) => item !== id), id]
      : payload.marketingTools.filter((item) => item !== id)
    patch({
      marketingTools,
      noneMarketingTools: false,
    })
  }

  function toggleNone(checked: boolean) {
    if (checked) {
      patch({
        noneMarketingTools: true,
        marketingTools: [],
      })
      setShowOtherTools(false)
      return
    }
    patch({ noneMarketingTools: false })
  }

  function toggleOther(checked: boolean) {
    setShowOtherTools(checked)
    if (checked) {
      patch({ noneMarketingTools: false })
    }
  }

  function handleComplete() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const result = await completeBriefingBrand(
        attachBriefingClientId(payload, writerClientId),
      )
      if (result.status === "unauthenticated") {
        setError("Sessão expirada. Atualize a página.")
        return
      }
      if (result.status === "error") {
        setError(result.message)
        return
      }
      markComplete(result.updatedAt, result.completedAt)
      if (result.completedAt) onContinue?.(result.completedAt)
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <BriefingSectionCard
        index={1}
        icon={<RiMegaphoneLine size={18} aria-hidden />}
        title="Processo de vendas"
        description="Explique como vocês vendem hoje, do primeiro contato ao fechamento."
      >
        <BriefingTextareaField
          id="briefing-sales-process"
          label="Como funciona o processo de vendas atual"
          rows={5}
          value={payload.salesProcess}
          onChange={(event) => patch({ salesProcess: event.target.value })}
        />
      </BriefingSectionCard>

      <BriefingSectionCard
        index={2}
        icon={<RiHistoryLine size={18} aria-hidden />}
        title="História e serviço"
        description="Conte um pouco da trajetória da empresa e do que vocês entregam."
      >
        <BriefingTextareaField
          id="briefing-company-story"
          label="História da empresa e sobre o serviço"
          rows={5}
          value={payload.companyStory}
          onChange={(event) => patch({ companyStory: event.target.value })}
        />
      </BriefingSectionCard>

      <BriefingSectionCard
        index={3}
        icon={<RiCustomerService2Line size={18} aria-hidden />}
        title="Produtos e serviços"
        description="Liste os principais, com nome e detalhes de cada um."
      >
        <BriefingCatalogEditor
          items={payload.productsAndServices}
          onChange={(productsAndServices) => patch({ productsAndServices })}
        />
      </BriefingSectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <BriefingSectionCard
          index={4}
          icon={<RiSearchEyeLine size={18} aria-hidden />}
          title="Atração de clientes"
          description="Como os clientes chegam até vocês hoje."
        >
          <BriefingTextareaField
            id="briefing-customer-attraction"
            label="Como atraem clientes atualmente"
            rows={5}
            value={payload.customerAttraction}
            onChange={(event) =>
              patch({ customerAttraction: event.target.value })
            }
          />
        </BriefingSectionCard>

        <BriefingSectionCard
          index={5}
          icon={<RiErrorWarningLine size={18} aria-hidden />}
          title="Desafios"
          description="Os maiores obstáculos do negócio neste momento."
        >
          <BriefingTextareaField
            id="briefing-challenges"
            label="Grandes desafios que enfrentam hoje"
            rows={5}
            value={payload.challenges}
            onChange={(event) => patch({ challenges: event.target.value })}
          />
        </BriefingSectionCard>
      </div>

      <BriefingSectionCard
        index={6}
        icon={<RiTeamLine size={18} aria-hidden />}
        title="Responsáveis do time"
        description="Responda com sim ou não e explique brevemente como a função é realizada."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <TeamRoleBlock
            id="briefing-commercial-team"
            label="Time comercial?"
            value={payload.commercialTeam}
            onChange={(commercialTeam) => patch({ commercialTeam })}
          />
          <TeamRoleBlock
            id="briefing-website-developer"
            label="Desenvolvedor de sites?"
            value={payload.websiteDeveloper}
            onChange={(websiteDeveloper) => patch({ websiteDeveloper })}
          />
          <TeamRoleBlock
            id="briefing-content-production"
            label="Produção de conteúdo?"
            value={payload.contentProduction}
            onChange={(contentProduction) => patch({ contentProduction })}
          />
        </div>
      </BriefingSectionCard>

      <BriefingSectionCard
        index={7}
        icon={<RiToolsLine size={18} aria-hidden />}
        title="Ferramentas de marketing"
        description="Marque o que já usam. Se não usam nenhuma, escolha essa opção."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => toggleNone(!payload.noneMarketingTools)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
              payload.noneMarketingTools
                ? "border-primary bg-primary/10"
                : "border-border bg-popover hover:border-primary/40",
            )}
          >
            <span className="pointer-events-none">
              <Checkbox
                id="briefing-tool-none"
                checked={payload.noneMarketingTools}
              />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs/relaxed text-foreground">
              <RiForbidLine
                size={16}
                aria-hidden
                className="text-muted-foreground"
              />
              Nenhuma
            </span>
          </button>

          {MARKETING_TOOL_IDS.map((id) => {
            const Icon = TOOL_ICONS[id]
            const checked =
              !payload.noneMarketingTools && payload.marketingTools.includes(id)
            return (
              <button
                key={id}
                type="button"
                disabled={payload.noneMarketingTools}
                onClick={() => toggleTool(id, !checked)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
                  checked
                    ? "border-primary bg-primary/10"
                    : "border-border bg-popover hover:border-primary/40",
                  payload.noneMarketingTools && "opacity-50",
                )}
              >
                <span className="pointer-events-none">
                  <Checkbox
                    id={`briefing-tool-${id}`}
                    checked={checked}
                    disabled={payload.noneMarketingTools}
                  />
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs/relaxed text-foreground">
                  <Icon
                    size={16}
                    aria-hidden
                    className="shrink-0 text-primary"
                  />
                  <span className="truncate">{MARKETING_TOOL_LABELS[id]}</span>
                </span>
              </button>
            )
          })}

          <button
            type="button"
            disabled={payload.noneMarketingTools}
            onClick={() => toggleOther(!showOtherTools)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
              showOtherTools && !payload.noneMarketingTools
                ? "border-primary bg-primary/10"
                : "border-border bg-popover hover:border-primary/40",
              payload.noneMarketingTools && "opacity-50",
            )}
          >
            <span className="pointer-events-none">
              <Checkbox
                id="briefing-tool-other"
                checked={showOtherTools && !payload.noneMarketingTools}
                disabled={payload.noneMarketingTools}
              />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs/relaxed text-foreground">
              <RiAddCircleLine
                size={16}
                aria-hidden
                className="text-muted-foreground"
              />
              Outra
            </span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showOtherTools && !payload.noneMarketingTools ? (
            <m.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reduced ? 0.12 : 0.24, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="pt-1">
                <BriefingChipField
                  id="briefing-other-marketing-tools"
                  label="Outras ferramentas"
                  values={payload.otherMarketingTools}
                  onChange={(otherMarketingTools) =>
                    patch({ otherMarketingTools })
                  }
                  placeholder="Digite e pressione Enter"
                />
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </BriefingSectionCard>

      <BriefingSectionCard
        index={8}
        icon={<RiSwordLine size={18} aria-hidden />}
        title="Concorrentes"
        description="Diferenciais, pontos fracos e a lista dos principais, por ordem de relevância."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <BriefingTextareaField
            id="briefing-competitive-advantages"
            label="Diferenciais em relação aos concorrentes"
            rows={5}
            value={payload.competitiveAdvantages}
            onChange={(event) =>
              patch({ competitiveAdvantages: event.target.value })
            }
          />
          <BriefingTextareaField
            id="briefing-competitive-weaknesses"
            label="Onde vocês perdem para os concorrentes"
            rows={5}
            value={payload.competitiveWeaknesses}
            onChange={(event) =>
              patch({ competitiveWeaknesses: event.target.value })
            }
          />
        </div>
        <BriefingChipField
          id="briefing-competitors"
          label="Principais concorrentes"
          values={payload.competitors}
          onChange={(competitors) => patch({ competitors })}
          placeholder="Digite e pressione Enter"
        />
      </BriefingSectionCard>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs/relaxed text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      {completed ? (
        <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-xs/relaxed text-success mb-15">
          Etapa concluída. Você pode continuar editando; as alterações seguem
          sendo salvas.
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-sticky">
        <div className="pointer-events-auto border-t border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
            <div className="min-w-0">
              <p className="inline-flex min-w-0 items-center gap-1.5 text-xs/relaxed text-muted-foreground">
                {saveState === "saving" || isCompleting ? (
                  <>
                    <Spinner aria-hidden className="size-3.5" />
                    Salvando…
                  </>
                ) : saveState === "saved" && savedAt ? (
                  <>
                    <RiCheckLine
                      size={14}
                      aria-hidden
                      className="text-success"
                    />
                    Salvo · {formatTimeShort(savedAt)}
                  </>
                ) : saveState === "error" ? (
                  <>
                    <RiCloseLine
                      size={14}
                      aria-hidden
                      className="text-destructive"
                    />
                    Não foi possível salvar
                  </>
                ) : (
                  "Rascunho salvo automaticamente"
                )}
              </p>
              {!ready && missingLabels.length > 0 ? (
                <p className="mt-0.5 truncate text-xs/relaxed text-muted-foreground">
                  Falta: {missingLabels.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onBack ? (
                <Button type="button" variant="ghost" onClick={onBack}>
                  Voltar
                </Button>
              ) : null}
              {variant === "staff" ? null : (
                <Button
                  type="button"
                  disabled={isCompleting || !ready}
                  onClick={handleComplete}
                >
                  {isCompleting
                    ? "Salvando..."
                    : completed
                      ? "Etapa concluída"
                      : "Continuar"}
                  {completed ? <RiCheckLine size={16} aria-hidden /> : null}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
