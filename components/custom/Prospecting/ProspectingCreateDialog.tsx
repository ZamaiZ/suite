"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiInformationLine,
  RiMapPinLine,
  RiRefreshLine,
  RiSearchEyeLine,
} from "react-icons/ri"
import {
  cancelProspectingRunAction,
  getProspectingSegmentCategoriesAction,
  prepareProspectingRunAction,
  refreshProspectingCategoryCatalogAction,
  searchProspectingCategoriesAction,
  startProspectingRunAction,
  type PrepareRunState,
  type ProspectingCategoryOption,
} from "@/app/actions/prospecting"
import { LeadLocationField } from "@/components/custom/LeadLocationField"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type { LeadSegment } from "@/lib/leads/segments"
import { categoryLabel } from "@/lib/prospecting/category-catalog"
import type { LeadLocationValue } from "@/components/custom/LeadLocationField"

type PreparedRun = Extract<PrepareRunState, { status: "success" }>

const EMPTY_LOCATION: LeadLocationValue = { state_code: "", city: "" }

function categoryOption(name: string): ProspectingCategoryOption {
  return { name, label: categoryLabel(name), businessCount: null }
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value)
}

export function ProspectingCreateDialog({
  segments,
}: {
  segments: LeadSegment[]
}) {
  const router = useRouter()
  const categoryAnchor = useComboboxAnchor()
  const segmentAnchor = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"configuration" | "confirmation">(
    "configuration",
  )
  const [segmentId, setSegmentId] = useState("")
  const [location, setLocation] = useState<LeadLocationValue>(EMPTY_LOCATION)
  const [categoryNames, setCategoryNames] = useState<string[]>([])
  const [primaryCategory, setPrimaryCategory] = useState("")
  const [resultLimit, setResultLimit] = useState("1000")
  const [budgetUsd, setBudgetUsd] = useState("10")
  const [categoryQuery, setCategoryQuery] = useState("")
  const [categoryOptions, setCategoryOptions] = useState<
    ProspectingCategoryOption[]
  >([])
  const [mappingPending, setMappingPending] = useState(false)
  const [categoriesPending, setCategoriesPending] = useState(false)
  const [catalogEmpty, setCatalogEmpty] = useState(false)
  const [catalogRefreshing, setCatalogRefreshing] = useState(false)
  const [prepared, setPrepared] = useState<PreparedRun | null>(null)
  const [message, setMessage] = useState("")
  const [isPreparing, startPreparing] = useTransition()
  const [isStarting, startStarting] = useTransition()
  const [isDiscarding, startDiscarding] = useTransition()

  const selectedSegment =
    segments.find((segment) => segment.id === segmentId) ?? null

  const availableCategoryOptions = useMemo(() => {
    const options = new Map(
      categoryOptions.map((option) => [option.name, option] as const),
    )
    for (const name of categoryNames) {
      if (!options.has(name)) options.set(name, categoryOption(name))
    }
    return [...options.values()]
  }, [categoryNames, categoryOptions])

  const selectedCategoryOptions = useMemo(
    () =>
      categoryNames.map(
        (name) =>
          availableCategoryOptions.find((option) => option.name === name) ??
          categoryOption(name),
      ),
    [availableCategoryOptions, categoryNames],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setCategoriesPending(true)
      void searchProspectingCategoriesAction({
        query: categoryQuery,
        limit: 50,
      }).then((result) => {
        if (cancelled) return
        setCategoriesPending(false)
        if (result.status === "error") {
          setMessage(result.message)
          return
        }
        setCategoryOptions(result.items)
        if (!categoryQuery.trim()) setCatalogEmpty(result.items.length === 0)
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [categoryQuery, open])

  // Limpar o segmento limpa as categorias herdadas dele. É uma derivação, não
  // um efeito: sai no mesmo render da troca e não pinta um quadro com o
  // mapeamento do segmento anterior ainda de pé.
  const [syncedSegmentId, setSyncedSegmentId] = useState(segmentId)
  if (syncedSegmentId !== segmentId) {
    setSyncedSegmentId(segmentId)
    if (segmentId) {
      setMappingPending(true)
      setMessage("")
    } else {
      setCategoryNames([])
      setPrimaryCategory("")
    }
  }

  useEffect(() => {
    if (!segmentId) return
    let cancelled = false
    const segmentName =
      segments.find((segment) => segment.id === segmentId)?.name ?? ""
    void getProspectingSegmentCategoriesAction(segmentId).then((result) => {
      if (cancelled) return
      setMappingPending(false)
      if (result.status === "error") {
        setMessage(result.message)
        return
      }
      setCategoryNames(result.mapping?.categoryNames ?? [])
      setPrimaryCategory(result.mapping?.primaryCategory ?? "")
      if (!result.mapping) setCategoryQuery(segmentName)
    })
    return () => {
      cancelled = true
    }
  }, [segmentId, segments])

  function reset() {
    setStep("configuration")
    setSegmentId("")
    setLocation(EMPTY_LOCATION)
    setCategoryNames([])
    setPrimaryCategory("")
    setResultLimit("1000")
    setBudgetUsd("10")
    setCategoryQuery("")
    setPrepared(null)
    setMessage("")
  }

  function requestClose() {
    if (isStarting || isDiscarding) return
    if (!prepared) {
      setOpen(false)
      reset()
      return
    }
    startDiscarding(async () => {
      const result = await cancelProspectingRunAction(prepared.runId)
      if (result.status === "error") {
        setMessage(result.message)
        return
      }
      setOpen(false)
      reset()
    })
  }

  function prepare() {
    setMessage("")
    const parsedLimit = Number(resultLimit)
    const parsedBudget = Number(budgetUsd.replace(",", "."))
    if (!segmentId) {
      setMessage("Selecione um segmento.")
      return
    }
    if (categoryNames.length < 1 || categoryNames.length > 10) {
      setMessage("Selecione entre 1 e 10 categorias.")
      return
    }
    if (!primaryCategory || !categoryNames.includes(primaryCategory)) {
      setMessage("Defina a categoria principal.")
      return
    }
    if (!location.state_code || !location.city) {
      setMessage("Selecione a UF e a cidade.")
      return
    }
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100_000) {
      setMessage("Informe um limite entre 1 e 100.000 resultados.")
      return
    }
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setMessage("Informe um orçamento maior que zero.")
      return
    }

    startPreparing(async () => {
      const result = await prepareProspectingRunAction({
        segmentId,
        city: location.city,
        stateCode: location.state_code,
        categoryNames,
        primaryCategory,
        resultLimit: parsedLimit,
        budgetUsd: parsedBudget,
      })
      if (result.status === "error") {
        setMessage(result.message)
        return
      }
      setPrepared(result)
      setStep("confirmation")
    })
  }

  function returnToConfiguration() {
    if (!prepared || isDiscarding) return
    setMessage("")
    startDiscarding(async () => {
      const result = await cancelProspectingRunAction(prepared.runId)
      if (result.status === "error") {
        setMessage(result.message)
        return
      }
      setPrepared(null)
      setStep("configuration")
    })
  }

  async function refreshCatalog() {
    if (catalogRefreshing) return
    setCatalogRefreshing(true)
    setMessage("")
    try {
      const refreshed = await refreshProspectingCategoryCatalogAction()
      if (refreshed.status === "error") {
        setMessage(refreshed.message)
        return
      }
      const searched = await searchProspectingCategoriesAction({ limit: 50 })
      if (searched.status === "error") {
        setMessage(searched.message)
        return
      }
      setCategoryOptions(searched.items)
      setCatalogEmpty(searched.items.length === 0)
      setCategoryQuery("")
      if (searched.items.length === 0) {
        setMessage(
          `O catálogo retornou ${refreshed.count.toLocaleString("pt-BR")} categorias, mas nenhuma ficou disponível para seleção.`,
        )
      }
    } catch {
      setMessage("Não foi possível atualizar o catálogo de categorias.")
    } finally {
      setCatalogRefreshing(false)
    }
  }

  function startRun() {
    if (!prepared) return
    setMessage("")
    startStarting(async () => {
      const result = await startProspectingRunAction(prepared.runId)
      if (result.status === "error") {
        if (result.started && result.runId) {
          setOpen(false)
          router.push(`/prospecting/${result.runId}`)
          router.refresh()
          return
        }
        setMessage(result.message)
        return
      }
      setOpen(false)
      router.push(`/prospecting/${prepared.runId}`)
      router.refresh()
    })
  }

  const primaryItems = selectedCategoryOptions.map((option) => ({
    value: option.name,
    label: option.label,
  }))
  const busy = isPreparing || isStarting || isDiscarding

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          return
        }
        requestClose()
      }}
    >
      <DialogTrigger render={<Button />} disabled={segments.length === 0}>
        <RiAddLine aria-hidden />
        Nova pesquisa
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl"
        showCloseButton={!isStarting && !isDiscarding}
      >
        <DialogHeader>
          <div className="text-xs font-medium text-primary">
            Etapa {step === "configuration" ? "1" : "2"} de 2
          </div>
          <DialogTitle>
            {step === "configuration"
              ? "Configurar pesquisa"
              : "Confirmar pesquisa"}
          </DialogTitle>
          <DialogDescription>
            {step === "configuration"
              ? "Defina o segmento, a cidade e o limite de coleta. Esta etapa não consulta empresas."
              : "Revise o alcance e o custo antes da primeira chamada paga."}
          </DialogDescription>
        </DialogHeader>

        {step === "configuration" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="prospecting-segment">Segmento</FieldLabel>
              <div ref={segmentAnchor}>
                <Combobox
                  items={segments}
                  value={selectedSegment}
                  onValueChange={(next) => {
                    const segment = Array.isArray(next) ? next[0] : next
                    setCategoryQuery("")
                    setSegmentId((segment as LeadSegment | null)?.id ?? "")
                  }}
                  isItemEqualToValue={(left, right) => left.id === right.id}
                  itemToStringLabel={(item) => item.name}
                  disabled={busy}
                  autoHighlight
                >
                  <ComboboxInput
                    id="prospecting-segment"
                    placeholder="Buscar segmento"
                    className="w-full"
                    autoFocus
                  />
                  <ComboboxContent anchor={segmentAnchor}>
                    <ComboboxEmpty>Nenhum segmento encontrado.</ComboboxEmpty>
                    <ComboboxList>
                      {(segment: LeadSegment) => (
                        <ComboboxItem key={segment.id} value={segment}>
                          {segment.name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              {mappingPending ? (
                <FieldDescription className="flex items-center gap-1">
                  <Spinner className="size-3" />
                  Carregando categorias do segmento…
                </FieldDescription>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="prospecting-categories">
                Categorias do Google Maps
              </FieldLabel>
              <Combobox
                multiple
                items={availableCategoryOptions}
                value={selectedCategoryOptions}
                onValueChange={(next) => {
                  const values = (Array.isArray(next) ? next : []).slice(0, 10)
                  const names = values.map((option) => option.name)
                  setCategoryNames(names)
                  if (!names.includes(primaryCategory)) {
                    setPrimaryCategory(names[0] ?? "")
                  }
                }}
                isItemEqualToValue={(left, right) => left.name === right.name}
                itemToStringLabel={(item) => item.label}
                inputValue={categoryQuery}
                onInputValueChange={setCategoryQuery}
                disabled={!segmentId || mappingPending || busy}
              >
                <ComboboxChips ref={categoryAnchor}>
                  {selectedCategoryOptions.map((option) => (
                    <ComboboxChip key={option.name}>{option.label}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    id="prospecting-categories"
                    placeholder={
                      categoryNames.length === 0
                        ? "Buscar categorias"
                        : categoryNames.length >= 10
                          ? "Limite de 10 categorias"
                          : "Adicionar categoria"
                    }
                    disabled={categoryNames.length >= 10 || busy}
                  />
                </ComboboxChips>
                <ComboboxContent anchor={categoryAnchor}>
                  <ComboboxEmpty>
                    {categoriesPending
                      ? "Buscando categorias…"
                      : "Nenhuma categoria encontrada."}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(option: ProspectingCategoryOption) => (
                      <ComboboxItem key={option.name} value={option}>
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
                        {option.businessCount !== null ? (
                          <span className="text-muted-foreground tabular-nums">
                            {option.businessCount.toLocaleString("pt-BR")}
                          </span>
                        ) : null}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <FieldDescription>
                Selecione de 1 a 10 categorias. O mapeamento fica salvo no
                segmento.
              </FieldDescription>
              {catalogEmpty ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-accent px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    O catálogo de categorias ainda está vazio.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshCatalog()}
                    disabled={catalogRefreshing || busy}
                  >
                    {catalogRefreshing ? (
                      <Spinner className="size-3" />
                    ) : (
                      <RiRefreshLine aria-hidden />
                    )}
                    Atualizar catálogo
                  </Button>
                </div>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="prospecting-primary-category">
                Categoria principal
              </FieldLabel>
              <Select
                items={primaryItems}
                value={primaryCategory || null}
                onValueChange={(next) => setPrimaryCategory(String(next))}
                disabled={categoryNames.length === 0 || busy}
              >
                <SelectTrigger
                  id="prospecting-primary-category"
                  className="w-full"
                >
                  <SelectValue placeholder="Selecionar categoria principal" />
                </SelectTrigger>
                <SelectContent align="start">
                  {primaryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <LeadLocationField
              id="prospecting-location"
              value={location}
              onValueChange={setLocation}
              disabled={busy}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="prospecting-result-limit">
                  Limite de resultados
                </FieldLabel>
                <Input
                  id="prospecting-result-limit"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  step={1}
                  value={resultLimit}
                  onChange={(event) => setResultLimit(event.target.value)}
                  disabled={busy}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="prospecting-budget">
                  Orçamento máximo (USD)
                </FieldLabel>
                <Input
                  id="prospecting-budget"
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  step="0.000001"
                  value={budgetUsd}
                  onChange={(event) => setBudgetUsd(event.target.value)}
                  disabled={busy}
                />
              </Field>
            </div>
          </FieldGroup>
        ) : prepared ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <RiMapPinLine className="text-primary" aria-hidden />
                Município e alcance
              </div>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Município</dt>
                  <dd className="text-right font-medium">
                    {prepared.confirmation.city}/
                    {prepared.confirmation.stateCode}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Código IBGE</dt>
                  <dd className="font-medium tabular-nums">
                    {prepared.confirmation.ibgeCode}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Círculo de coleta</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {prepared.confirmation.radiusKm.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    km
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Centro</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {prepared.confirmation.centerLatitude.toFixed(5)},{" "}
                    {prepared.confirmation.centerLongitude.toFixed(5)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <RiSearchEyeLine className="text-primary" aria-hidden />
                Custo da coleta
              </div>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Por requisição</dt>
                  <dd className="font-medium tabular-nums">
                    {money(prepared.confirmation.rate.perRequest)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Por resultado</dt>
                  <dd className="font-medium tabular-nums">
                    {money(prepared.confirmation.rate.perResult)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Primeira página</dt>
                  <dd className="text-right font-medium tabular-nums">
                    até {money(prepared.confirmation.maximumFirstPageCostUsd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Orçamento total</dt>
                  <dd className="font-medium tabular-nums">
                    {money(prepared.confirmation.budgetUsd)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex gap-2 rounded-lg border border-border bg-accent p-3 text-xs text-accent-foreground sm:col-span-2">
              <RiInformationLine className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <p>
                O total de empresas só será conhecido depois da primeira
                resposta. A coleta respeita o limite de{" "}
                {prepared.confirmation.resultLimit.toLocaleString("pt-BR")} e
                o orçamento informado.
              </p>
            </div>
          </div>
        ) : null}

        <FieldError aria-live="polite">{message}</FieldError>

        <DialogFooter>
          {step === "configuration" ? (
            <>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={prepare}
                disabled={busy || mappingPending || segments.length === 0}
              >
                {isPreparing ? <Spinner className="size-3" /> : null}
                Revisar pesquisa
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={returnToConfiguration}
                disabled={busy}
              >
                <RiArrowLeftLine aria-hidden />
                Voltar
              </Button>
              <Button type="button" onClick={startRun} disabled={busy}>
                {isStarting ? <Spinner className="size-3" /> : null}
                Iniciar pesquisa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
