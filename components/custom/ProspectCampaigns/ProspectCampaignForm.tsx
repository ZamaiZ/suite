"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  RiAlertLine,
  RiRadarLine,
  RiSearchLine,
  RiSparklingLine,
} from "react-icons/ri"
import { cn } from "cn"

import {
  createProspectCampaign,
  estimateCampaign,
  listProspectCategories,
} from "@/app/actions/prospect"
import type { BusinessCategory } from "@/lib/dataforseo/business-listings"
import type { CampaignEstimate, ProspectFilters } from "@/lib/prospect/campaign-input"
import {
  PROSPECT_CATEGORIES_MAX,
  PROSPECT_RADIUS_DEFAULT_KM,
  PROSPECT_RADIUS_MAX_KM,
  PROSPECT_RADIUS_MIN_KM,
  PROSPECT_TARGET_DEFAULT,
  PROSPECT_TARGET_MAX,
} from "@/lib/prospect/campaign-input"
import { LeadLocationField } from "@/components/custom/LeadLocationField"
import type { LeadLocationValue } from "@/components/custom/LeadLocationField/LeadLocationField.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"

/**
 * Montar a campanha, e ver o preço antes de pagar.
 *
 * Três passos, e não um botão só — é o mesmo corte de `ClientResearchRunner`:
 * escolher é grátis, estimar custa alguns centavos, descobrir custa o resto.
 * Um botão só esconderia do SDR o único número que ele precisa ver antes de
 * gastar.
 */

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUM = new Intl.NumberFormat("pt-BR")

type Props = { onDone?: () => void }

export function ProspectCampaignForm({ onDone }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [catalog, setCatalog] = useState<BusinessCategory[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const [name, setName] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [location, setLocation] = useState<LeadLocationValue>({
    state_code: "",
    city: "",
  })
  const [radiusKm, setRadiusKm] = useState(PROSPECT_RADIUS_DEFAULT_KM)
  const [targetCount, setTargetCount] = useState(PROSPECT_TARGET_DEFAULT)
  const [filters, setFilters] = useState<ProspectFilters>({})

  const [estimate, setEstimate] = useState<CampaignEstimate | null>(null)
  const [estimateCost, setEstimateCost] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void listProspectCategories().then((r) => {
      if (cancelled) return
      if (r.status === "success") setCatalog(r.categories)
      else setCatalogError(r.message)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * O catálogo tem mais de cinco mil categorias. Sem filtro por digitação, a
   * lista é inútil; com ela, o que aparece são as trinta maiores que casam —
   * porque tamanho no catálogo é um bom desempate para quem não sabe o nome
   * exato da categoria do Google.
   */
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? catalog.filter((c) => c.id.includes(q))
      : catalog.slice(0, 200)
    return [...base]
      .sort((a, b) => b.businessCount - a.businessCount)
      .slice(0, 30)
  }, [catalog, query])

  const podeEstimar =
    categories.length > 0 && location.state_code !== "" && location.city !== ""

  // Trocar qualquer premissa invalida a estimativa: mostrar o número antigo ao
  // lado de um filtro novo seria mentir sobre o que vai ser comprado.
  //
  // No render, e não num efeito. É a convenção do repositório, e aqui ela tem
  // uma razão extra: num efeito, existiria um quadro em que o filtro já mudou
  // e o preço antigo ainda está na tela — e é exatamente nesse quadro que o
  // SDR clicaria em "Criar campanha".
  const premissa = JSON.stringify({
    categories,
    city: location.city,
    state: location.state_code,
    radiusKm,
    targetCount,
    filters,
  })
  const [premissaEstimada, setPremissaEstimada] = useState(premissa)
  if (premissaEstimada !== premissa) {
    setPremissaEstimada(premissa)
    setEstimate(null)
    setEstimateCost(0)
  }

  function handleEstimate() {
    setMessage(null)
    setFieldErrors({})
    startTransition(async () => {
      const r = await estimateCampaign({
        categories,
        city: location.city,
        stateCode: location.state_code,
        radiusKm,
        targetCount,
        filters,
      })
      if (r.status === "error") {
        setMessage(r.message)
        setFieldErrors(r.fieldErrors ?? {})
        return
      }
      setEstimate(r.estimate)
      setEstimateCost(r.costUsd)
    })
  }

  function handleCreate() {
    setMessage(null)
    setFieldErrors({})
    startTransition(async () => {
      const r = await createProspectCampaign({
        name: name.trim() || sugerirNome(categories, location.city),
        categories,
        city: location.city,
        stateCode: location.state_code,
        radiusKm,
        targetCount,
        filters,
        estimate,
        estimateCostUsd: estimateCost,
      })
      if (r.status === "error") {
        setMessage(r.message)
        setFieldErrors(r.fieldErrors ?? {})
        return
      }
      onDone?.()
      router.push(`/prospeccao/${r.campaignId}`)
    })
  }

  const universo = estimate?.universeCount ?? null
  const semSite =
    estimate && estimate.universeCount > 0
      ? estimate.universeCount - estimate.withWebsiteCount
      : null

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="campaign-name">Nome da campanha</FieldLabel>
        <Input
          id="campaign-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={sugerirNome(categories, location.city)}
          disabled={pending}
          maxLength={120}
        />
        <FieldError>{fieldErrors.name}</FieldError>
      </Field>

      <Field data-invalid={fieldErrors.categories ? true : undefined}>
        <FieldLabel htmlFor="campaign-categories">
          Segmento{" "}
          <span className="text-muted-foreground font-normal">
            (até {PROSPECT_CATEGORIES_MAX})
          </span>
        </FieldLabel>
        <Combobox
          items={options.map((o) => o.id)}
          value={categories}
          onValueChange={(v) => setCategories((v as string[]).slice(0, PROSPECT_CATEGORIES_MAX))}
          inputValue={query}
          onInputValueChange={setQuery}
          multiple
          disabled={pending || catalog.length === 0}
        >
          <ComboboxChipsInput
            id="campaign-categories"
            placeholder={
              catalog.length === 0
                ? "Carregando o catálogo…"
                : "dentist, beauty_salon, restaurant…"
            }
          />
          <ComboboxContent>
            <ComboboxEmpty>Nenhuma categoria com esse nome.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => {
                const info = options.find((o) => o.id === item)
                return (
                  <ComboboxItem key={item} value={item}>
                    <span className="truncate">{item}</span>
                    {info ? (
                      <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                        {NUM.format(info.businessCount)}
                      </span>
                    ) : null}
                  </ComboboxItem>
                )
              }}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldError>{fieldErrors.categories ?? catalogError ?? undefined}</FieldError>
      </Field>

      <LeadLocationField
        id="campaign-location"
        value={location}
        onValueChange={setLocation}
        cityError={fieldErrors.city}
        disabled={pending}
      />

      <Field>
        <FieldLabel htmlFor="campaign-radius">
          Raio{" "}
          <span className="text-muted-foreground font-normal tabular-nums">
            {radiusKm} km
          </span>
        </FieldLabel>
        <Slider
          id="campaign-radius"
          value={[radiusKm]}
          onValueChange={(v) => setRadiusKm(Array.isArray(v) ? v[0] : v)}
          min={PROSPECT_RADIUS_MIN_KM}
          max={PROSPECT_RADIUS_MAX_KM}
          step={1}
          disabled={pending}
        />
        <FieldError>{fieldErrors.radiusKm}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="campaign-target">Quantas empresas trazer</FieldLabel>
        <Input
          id="campaign-target"
          type="number"
          inputMode="numeric"
          min={1}
          max={PROSPECT_TARGET_MAX}
          value={targetCount}
          onChange={(e) => setTargetCount(Number(e.target.value) || 0)}
          disabled={pending}
        />
        <FieldError>{fieldErrors.targetCount}</FieldError>
      </Field>

      <Separator />

      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="text-xs/relaxed font-medium">
          Qualificação
          <span className="text-muted-foreground ml-1.5 font-normal">
            aplicada no servidor — só se paga pelo que volta
          </span>
        </legend>
        <FiltroLinha
          id="f-unclaimed"
          checked={filters.onlyUnclaimed ?? false}
          onChange={(v) => setFilters((f) => ({ ...f, onlyUnclaimed: v }))}
          label="Só perfis não reivindicados"
          hint="Entre 32% e 52% da amostra. É a lista de uma agência de GBP."
        />
        <FiltroLinha
          id="f-nosite"
          checked={filters.onlyWithoutWebsite ?? false}
          onChange={(v) => setFilters((f) => ({ ...f, onlyWithoutWebsite: v }))}
          label="Só empresas sem site"
          hint="De 60% a 79% não têm."
        />
        <FiltroLinha
          id="f-phone"
          checked={filters.onlyWithPhone ?? false}
          onChange={(v) => setFilters((f) => ({ ...f, onlyWithPhone: v }))}
          label="Só com telefone"
          hint="Sem ele não há como abordar nem cruzar o CNPJ."
        />
      </fieldset>

      {message ? (
        <p
          role="alert"
          aria-live="polite"
          className="text-destructive flex items-start gap-1.5 text-xs/relaxed"
        >
          <RiAlertLine aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {message}
        </p>
      ) : null}

      {estimate ? (
        <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
          <div className="grid grid-cols-3 gap-3">
            <Numero label="Na área" value={universo === null ? "—" : NUM.format(universo)} />
            <Numero
              label="Sem site"
              value={semSite === null ? "—" : NUM.format(semSite)}
            />
            <Numero
              label="Vai trazer"
              value={NUM.format(estimate.plannedCount)}
              tone="text-foreground"
            />
          </div>
          {estimate.byCategory.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {estimate.byCategory.map((c) => (
                <Badge key={c.category} variant="secondary" className="font-normal">
                  {c.category} · {NUM.format(c.count)}
                </Badge>
              ))}
            </ul>
          ) : null}
          {estimate.related.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground text-xs/relaxed">
                Categorias vizinhas na mesma área — clique para incluir:
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {estimate.related.slice(0, 6).map((c) => (
                  <li key={c.category}>
                    <button
                      type="button"
                      disabled={pending || categories.length >= PROSPECT_CATEGORIES_MAX}
                      onClick={() =>
                        setCategories((prev) =>
                          prev.includes(c.category)
                            ? prev
                            : [...prev, c.category].slice(0, PROSPECT_CATEGORIES_MAX),
                        )
                      }
                      className={cn(
                        "border-border/70 text-muted-foreground hover:border-primary hover:text-foreground",
                        "rounded-md border border-dashed px-2 py-0.5 text-xs transition-colors",
                        "disabled:pointer-events-none disabled:opacity-50",
                      )}
                    >
                      + {c.category} · {NUM.format(c.count)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs/relaxed">
          {estimate
            ? `Descoberta: ${CURRENCY.format(estimate.costUsd)}`
            : "A estimativa custa cerca de US$ 0,05."}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleEstimate}
            disabled={!podeEstimar || pending}
          >
            {pending && !estimate ? (
              <Spinner aria-hidden />
            ) : (
              <RiSearchLine aria-hidden />
            )}
            Estimar
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!podeEstimar || pending}>
            {pending && estimate ? (
              <Spinner aria-hidden />
            ) : estimate ? (
              <RiRadarLine aria-hidden />
            ) : (
              <RiSparklingLine aria-hidden />
            )}
            Criar campanha
          </Button>
        </div>
      </div>
    </div>
  )
}

function FiltroLinha({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-xs/relaxed font-medium">
          {label}
        </label>
        <span className="text-muted-foreground text-xs/relaxed">{hint}</span>
      </div>
    </div>
  )
}

function Numero({
  label,
  value,
  tone = "text-muted-foreground",
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-lg font-semibold tabular-nums", tone)}>
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  )
}

function sugerirNome(categories: string[], city: string): string {
  const seg = categories[0] ?? "Prospecção"
  return city ? `${seg} · ${city}` : seg
}
