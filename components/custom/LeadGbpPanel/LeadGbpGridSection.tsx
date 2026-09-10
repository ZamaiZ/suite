"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiSearchLine,
} from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { LeadGbpGridCompetitors } from "./LeadGbpGridCompetitors"
import { StepMeter, StepStat } from "@/components/custom/LeadStepShell"
import { LeadGbpGridMap } from "./LeadGbpGridMap"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { cn } from "cn"
import { pollLeadGbpGridScan, startLeadGbpGridScan } from "@/app/actions/leads"
import {
  GBP_GRID_RADIUS_KM_DEFAULT,
  GBP_GRID_RADIUS_KM_MAX,
  GBP_GRID_RADIUS_KM_MIN,
  GBP_GRID_SIZE_DEFAULT,
  GBP_GRID_SIZES,
  gbpGridCost,
  gbpGridFailedCount,
  gbpGridMetrics,
  gbpGridExecutionMode,
  gbpGridScanActive,
  type GbpGridMode,
  type LeadGbpGridScan,
} from "@/lib/leads/gbp-grid"
import { gbpGridPositionSnapshot } from "@/lib/leads/gbp-grid-competitors"
import { formatUsd } from "@/lib/dataforseo/usage"

/**
 * A fila padrão responde em minutos, então bater de 2,5 em 2,5 segundos era só
 * ruído. O modo live responde em segundos e continua no ritmo curto.
 */
const POLL_LIVE_MS = 2500
const POLL_QUEUED_MS = 8000
const POLL_MAX_MS = 600_000

const MODE_ITEMS = [
  { value: "live", label: "Modo live" },
  { value: "queued", label: "Fila padrão" },
]

const QUEUE_WAITING =
  "A malha continua na fila do provedor. Volte mais tarde e clique em Retomar."

function metricLabel(value: number | null, suffix = ""): string {
  if (value === null) return "—"
  return `${value.toLocaleString("pt-BR")}${suffix}`
}

export function LeadGbpGridSection({
  profileId,
  keywords,
  initialScan,
  canEdit,
  mapMounted,
}: {
  profileId: string
  keywords: string[]
  initialScan: LeadGbpGridScan | null
  canEdit: boolean
  /**
   * O mapa monta na primeira visita à aba Ranking e fica. O painel vive sob
   * `keepMounted`; sem esta guarda o Google Maps JS carregaria em todo perfil
   * aberto, inclusive nos que ninguém vai olhar.
   */
  mapMounted: boolean
}) {
  const [scan, setScan] = useState<LeadGbpGridScan | null>(initialScan)
  const [keyword, setKeyword] = useState(keywords[0] ?? "")
  const [source, setSource] = useState(`${profileId}:${initialScan?.id ?? ""}`)
  const [size, setSize] = useState<number>(GBP_GRID_SIZE_DEFAULT)
  const [mode, setMode] = useState<GbpGridMode>(
    gbpGridExecutionMode(GBP_GRID_SIZE_DEFAULT),
  )
  const [radiusKm, setRadiusKm] = useState(GBP_GRID_RADIUS_KM_DEFAULT)
  const [busy, setBusy] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Impede que um tick comece antes de o anterior terminar. */
  const inFlightRef = useRef(false)

  // Troca de perfil ou de malha reinicia o painel. Ajustar durante a render é o
  // caminho recomendado para estado derivado de prop; num efeito, viraria uma
  // renderização em cascata.
  const nextSource = `${profileId}:${initialScan?.id ?? ""}`
  if (nextSource !== source) {
    setSource(nextSource)
    setScan(initialScan)
    setError(null)
    setTimedOut(false)
  }

  // A keyword vigente é derivada, não sincronizada: se a lista mudou e a
  // escolhida sumiu, a primeira vale.
  const activeKeyword = keywords.includes(keyword)
    ? keyword
    : (keywords[0] ?? "")

  const active = gbpGridScanActive(scan)
  const scanId = scan?.id ?? null
  const scanMode = scan?.mode ?? null

  // Enquanto houver ponto em aberto, o poll continua e a malha preenche na
  // tela. O teto de tempo evita laço infinito se algo travar do outro lado.
  useEffect(() => {
    if (!active || !scanId || !scanMode) return
    const id = scanId
    const intervalMs = scanMode === "queued" ? POLL_QUEUED_MS : POLL_LIVE_MS
    let cancelled = false
    const startedAt = Date.now()

    async function tick() {
      // Sem esta guarda o intervalo empilhava chamadas quando uma passada
      // demorava mais que o intervalo, e cada uma era uma server action inteira.
      if (cancelled || inFlightRef.current) return
      if (Date.now() - startedAt >= POLL_MAX_MS) {
        setTimedOut(true)
        return
      }
      inFlightRef.current = true
      try {
        const formData = new FormData()
        formData.set("scan_id", id)
        const result = await pollLeadGbpGridScan(formData)
        if (cancelled) return
        if (result.status === "error") {
          setError(result.message)
          return
        }
        setScan(result.scan)
      } finally {
        inFlightRef.current = false
      }
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [active, scanId, scanMode])

  async function handleStart() {
    if (!activeKeyword) return
    setBusy(true)
    setError(null)
    setTimedOut(false)
    const formData = new FormData()
    formData.set("profile_id", profileId)
    formData.set("keyword", activeKeyword)
    formData.set("size", String(size))
    formData.set("radius_km", String(radiusKm))
    formData.set("mode", mode)
    const result = await startLeadGbpGridScan(formData)
    setBusy(false)
    if (result.status === "error") {
      setError(result.message)
      return
    }
    setScan(result.scan)
  }

  async function handleResume() {
    if (!scan) return
    setBusy(true)
    setError(null)
    setTimedOut(false)
    const formData = new FormData()
    formData.set("scan_id", scan.id)
    // Só o clique explícito libera nova tentativa nos pontos falhos.
    formData.set("reset_failed", "1")
    const result = await pollLeadGbpGridScan(formData)
    setBusy(false)
    if (result.status === "error") {
      setError(result.message)
      return
    }
    setScan(result.scan)
  }

  const metrics = scan ? gbpGridMetrics(scan.points) : null
  // Retrato de posicionamento sobre os concorrentes que a malha já guardava
  // por ponto e nenhuma tela exibia.
  const position = scan ? gbpGridPositionSnapshot(scan.points) : null
  const requests = gbpGridCost(size)
  const failed = scan ? gbpGridFailedCount(scan.points) : 0
  const stalled = scan?.status === "partial" || scan?.status === "failed"
  const canResume =
    canEdit && Boolean(scan) && (stalled || (timedOut && active))

  const keywordItems = useMemo(
    () => keywords.map((item) => ({ value: item, label: item })),
    [keywords],
  )
  const sizeItems = useMemo(
    () =>
      GBP_GRID_SIZES.map((item) => ({
        value: String(item),
        label: `${item}×${item}`,
      })),
    [],
  )

  return (
    <LeadGbpCard title="Malha geográfica" className="h-full">
      <div className="flex flex-col gap-3">
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-44 flex-col gap-1">
                <span className="text-xs/relaxed text-muted-foreground">
                  Keyword
                </span>
                <Select
                  items={keywordItems}
                  value={activeKeyword}
                  onValueChange={(value) => setKeyword(String(value))}
                  disabled={busy || active || keywords.length === 0}
                >
                  <SelectTrigger
                    id={`gbp-grid-keyword-${profileId}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {keywords.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex min-w-28 flex-col gap-1">
                <span className="text-xs/relaxed text-muted-foreground">
                  Malha
                </span>
                <Select
                  items={sizeItems}
                  value={String(size)}
                  disabled={busy || active}
                  onValueChange={(value) => {
                    const next = Number(value)
                    setSize(next)
                    // O modo acompanha o tamanho, e o usuário pode trocar depois.
                    setMode(gbpGridExecutionMode(next))
                  }}
                >
                  <SelectTrigger
                    id={`gbp-grid-size-${profileId}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {GBP_GRID_SIZES.map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        {item}×{item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex min-w-32 flex-col gap-1">
                <span className="text-xs/relaxed text-muted-foreground">
                  Execução
                </span>
                <Select
                  items={MODE_ITEMS}
                  value={mode}
                  disabled={busy || active}
                  onValueChange={(value) => {
                    const next = String(value)
                    if (next === "live" || next === "queued") setMode(next)
                  }}
                >
                  <SelectTrigger
                    id={`gbp-grid-mode-${profileId}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {MODE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex min-w-44 flex-col gap-1">
                <span className="text-xs/relaxed text-muted-foreground">
                  Raio · {radiusKm.toLocaleString("pt-BR")} km
                </span>
                <Slider
                  id={`gbp-grid-radius-${profileId}`}
                  min={GBP_GRID_RADIUS_KM_MIN}
                  max={GBP_GRID_RADIUS_KM_MAX}
                  step={1}
                  value={[radiusKm]}
                  disabled={busy || active}
                  onValueChange={(value) =>
                    setRadiusKm(
                      Array.isArray(value) ? (value[0] ?? radiusKm) : value,
                    )
                  }
                />
              </label>

              <Button
                type="button"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                disabled={busy || active || !activeKeyword}
                onClick={() => {
                  void handleStart()
                }}
              >
                {busy ? <Spinner aria-hidden className="size-4" /> : null}
                Rodar malha
              </Button>

              {/* Requisições e modo antes do disparo: cada ponto é pago. */}
              <span className="pb-2 text-xs/relaxed text-muted-foreground">
                {requests.toLocaleString("pt-BR")} requisições ·{" "}
                {mode === "live" ? "modo live" : "fila padrão"}
              </span>
            </div>
          ) : null}

          {error ? (
            <p className="text-xs/relaxed text-destructive">{error}</p>
          ) : null}

          {scan ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-[22px] items-center gap-1 rounded-md bg-primary/10 px-2 text-[11px] font-medium text-primary">
                  <RiSearchLine size={12} aria-hidden />
                  {scan.keyword}
                </span>
                <span className="inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] tabular-nums text-muted-foreground">
                  {scan.size}×{scan.size}
                </span>
                <span className="inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] tabular-nums text-muted-foreground">
                  {scan.radius_km.toLocaleString("pt-BR")} km
                </span>
                <span className="inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] text-muted-foreground">
                  {scan.mode === "live" ? "live" : "fila"}
                </span>

                <span className="flex-1" />

                {active ? (
                  <Spinner aria-hidden className="size-3.5 text-muted-foreground" />
                ) : null}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] tabular-nums",
                    failed > 0
                      ? "text-destructive"
                      : scan.processed >= scan.total
                        ? "text-success"
                        : "text-muted-foreground",
                  )}
                >
                  {failed > 0 ? (
                    <RiAlertLine size={13} aria-hidden />
                  ) : scan.processed >= scan.total ? (
                    <RiCheckboxCircleLine size={13} aria-hidden />
                  ) : null}
                  {scan.processed.toLocaleString("pt-BR")} de{" "}
                  {scan.total.toLocaleString("pt-BR")} pontos
                  {failed > 0
                    ? ` · ${failed.toLocaleString("pt-BR")} falharam`
                    : ""}
                </span>
                {/* Custo real devolvido pela API, não estimativa. */}
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatUsd(scan.cost_usd)}
                </span>
              </div>

              {metrics ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {/*
                    Escala declarada em cada tile. "13" e "20,51" são ilegíveis
                    sem dizer que 1 é o topo — isso não é acabamento, é o que
                    faz o número significar alguma coisa.
                  */}
                  <StepStat
                    label="ARP"
                    value={metricLabel(metrics.arp)}
                    hint="posição média onde aparece · 1 é o topo"
                  />
                  <StepStat
                    label="ATRP"
                    value={metricLabel(metrics.atrp)}
                    hint="posição média contando as ausências"
                  />
                  <StepStat
                    label="SoLV"
                    value={metricLabel(metrics.solv, "%")}
                    tone={
                      metrics.solv === null
                        ? "neutral"
                        : metrics.solv <= 0
                          ? "danger"
                          : metrics.solv < 20
                            ? "warning"
                            : "success"
                    }
                    hint={
                      metrics.solv === null
                        ? "share of local voice"
                        : metrics.solv <= 0
                          ? "nenhuma célula no top 3"
                          : `células no top 3 · ${metrics.found.toLocaleString("pt-BR")} de ${metrics.total.toLocaleString("pt-BR")} com o perfil`
                    }
                  >
                    <StepMeter
                      share={(metrics.solv ?? 0) / 100}
                      tone={
                        metrics.solv === null
                          ? "neutral"
                          : metrics.solv <= 0
                            ? "danger"
                            : metrics.solv < 20
                              ? "warning"
                              : "success"
                      }
                      trackClassName="mt-2"
                    />
                  </StepStat>
                </div>
              ) : null}

              {mapMounted ? (
                <LeadGbpGridMap
                  centerLat={scan.center_lat}
                  centerLng={scan.center_lng}
                  points={scan.points}
                  className="h-[300px] rounded-lg"
                />
              ) : null}

              {position && position.measured > 0 ? (
                <LeadGbpGridCompetitors position={position} />
              ) : null}

              {canResume ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs/relaxed text-muted-foreground">
                    {timedOut && active
                      ? QUEUE_WAITING
                      : (scan.error_message ??
                        "A malha parou antes de terminar.")}
                  </p>
                  {/* Retoma nos pendentes; só o ponto falho volta a ser pago. */}
                  {failed > 0 ? (
                    <p className="text-xs/relaxed text-muted-foreground">
                      {failed.toLocaleString("pt-BR")} ponto(s) serão cobrados
                      de novo.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      void handleResume()
                    }}
                  >
                    Retomar
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs/relaxed text-muted-foreground">
              Nenhuma malha rodada para este perfil.
            </p>
          )}
      </div>
    </LeadGbpCard>
  )
}
