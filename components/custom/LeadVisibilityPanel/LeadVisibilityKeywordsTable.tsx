"use client"

import { useMemo, useState } from "react"
import {
  RiArrowDownLine,
  RiArrowRightUpLine,
  RiArrowUpLine,
  RiBookOpenLine,
  RiChatQuoteLine,
  RiMapPin2Line,
  RiQuestionLine,
  RiSearchLine,
  RiShoppingBag3Line,
  RiSparkling2Line,
  RiTimeLine,
  RiTranslate2,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import { cn } from "cn"
import { StepCard } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/date-time"
import {
  foldVisibilityText,
  VISIBILITY_INTENT_LABELS,
  type VisibilityKeywordRow,
  type VisibilitySnapshot,
} from "@/lib/leads/visibility-audit"
import {
  formatVisibilityMetric,
  isVisibilityRowStale,
  visibilityAdsCompetitionLabel,
  visibilityIntentDetail,
  visibilityIntentLabel,
  visibilityRowFlags,
  type VisibilityRowFlag,
} from "@/lib/leads/visibility-presenters"

/** Teto inicial e incremento do "ver mais". Mil linhas de uma vez não se lê. */
const PAGE = 50

type SortKey = "position" | "traffic" | "volume" | "difficulty"
type Band = "todas" | "top3" | "top10" | "11a20" | "21mais"

const BANDS: ReadonlyArray<{ id: Band; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "top3", label: "Top 3" },
  { id: "top10", label: "Top 10" },
  { id: "11a20", label: "11–20" },
  { id: "21mais", label: "21+" },
]

const INTENT_ITEMS = [
  { value: "todas", label: "Toda intenção" },
  ...Object.entries(VISIBILITY_INTENT_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
  { value: "sem", label: "Sem classificação" },
]

function inBand(row: VisibilityKeywordRow, band: Band): boolean {
  const position = row.position.value
  if (band === "todas") return true
  if (position === null) return false
  if (band === "top3") return position <= 3
  if (band === "top10") return position <= 10
  if (band === "11a20") return position >= 11 && position <= 20
  return position >= 21
}

function sortValue(row: VisibilityKeywordRow, key: SortKey): number | null {
  if (key === "position") return row.position.value
  if (key === "traffic") return row.traffic
  if (key === "volume") return row.volume.value
  return row.difficulty.index
}

function SortableHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: "asc" | "desc"
  onSort: (key: SortKey) => void
}) {
  return (
    <TableHead
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {label}
        {/* Direção por ícone, nunca só por cor. */}
        {active ? (
          dir === "asc" ? (
            <RiArrowUpLine size={12} aria-hidden />
          ) : (
            <RiArrowDownLine size={12} aria-hidden />
          )
        ) : null}
      </button>
    </TableHead>
  )
}

const FLAG_ICON: Record<string, IconType> = {
  featured_snippet: RiChatQuoteLine,
  local_pack: RiMapPin2Line,
  popular_products: RiShoppingBag3Line,
  knowledge_graph: RiBookOpenLine,
  ai_overview: RiSparkling2Line,
  people_also_ask: RiQuestionLine,
  language_mismatch: RiTranslate2,
  stale: RiTimeLine,
}

/**
 * Um tooltip por linha, não um por ícone.
 *
 * Cinco tooltips numa célula seriam cinco alvos de hover competindo no mesmo
 * centímetro. O grupo inteiro é o gatilho, e o conteúdo lista por extenso o que
 * aquela SERP tem — cada ícone mantém `aria-label` próprio, porque leitor de
 * tela não faz hover.
 */
function RowFlags({ flags }: { flags: VisibilityRowFlag[] }) {
  if (flags.length === 0) return null
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex shrink-0 items-center gap-1" />}
      >
        {flags.map((flag) => {
          const Icon = FLAG_ICON[flag.id]
          if (!Icon) return null
          return (
            <Icon
              key={flag.id}
              size={12}
              aria-label={flag.label}
              className={
                flag.kind === "quality"
                  ? "text-warning"
                  : "text-muted-foreground"
              }
            />
          )
        })}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        {flags.map((flag) => (
          <span key={flag.id}>
            {flag.kind === "quality" ? "⚠ " : "Na SERP: "}
            {flag.label}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

export function LeadVisibilityKeywordsTable({
  snapshot,
}: {
  snapshot: VisibilitySnapshot
}) {
  const [query, setQuery] = useState("")
  const [intent, setIntent] = useState("todas")
  const [band, setBand] = useState<Band>("todas")
  const [host, setHost] = useState("todos")
  const [sort, setSort] = useState<SortKey>("position")
  const [dir, setDir] = useState<"asc" | "desc">("asc")
  const [limit, setLimit] = useState(PAGE)

  const hosts = snapshot.hosts
  const hostItems = useMemo(
    () => [
      { value: "todos", label: "Todos os hosts" },
      ...hosts.map((item) => ({ value: item.host, label: item.host })),
    ],
    [hosts],
  )

  const folded = foldVisibilityText(query)
  const rows = useMemo(() => {
    const filtered = snapshot.keywords.filter((row) => {
      if (folded && !foldVisibilityText(row.keyword).includes(folded)) {
        return false
      }
      if (intent === "sem") {
        if (visibilityIntentLabel(row.intent) !== "—") return false
      } else if (intent !== "todas") {
        if (row.intent?.label !== intent) return false
        // Abaixo do limiar a tela cala, então filtrar por aquele rótulo não
        // pode trazer de volta o que a coluna se recusa a afirmar.
        if (visibilityIntentLabel(row.intent) === "—") return false
      }
      if (!inBand(row, band)) return false
      if (host !== "todos" && row.url?.host !== host) return false
      return true
    })
    const sign = dir === "asc" ? 1 : -1
    return filtered.sort((left, right) => {
      const a = sortValue(left, sort)
      const b = sortValue(right, sort)
      // Ausente vai sempre para o fim, independente da direção: `—` no topo de
      // uma ordenação por tráfego não é informação, é ruído.
      if (a === null && b === null) {
        return left.keyword.localeCompare(right.keyword, "pt-BR")
      }
      if (a === null) return 1
      if (b === null) return -1
      if (a !== b) return (a - b) * sign
      return left.keyword.localeCompare(right.keyword, "pt-BR")
    })
  }, [snapshot.keywords, folded, intent, band, host, sort, dir])

  // Reset do teto ligado ao filtro: no render, não em efeito. Um `useEffect`
  // faria o mesmo trabalho um render depois — e esse render pinta a lista longa
  // antes de encurtar.
  const filterKey = `${folded}|${intent}|${band}|${host}|${sort}|${dir}`
  const [syncedFilterKey, setSyncedFilterKey] = useState(filterKey)
  if (syncedFilterKey !== filterKey) {
    setSyncedFilterKey(filterKey)
    setLimit(PAGE)
  }

  function handleSort(key: SortKey) {
    if (key === sort) {
      setDir((current) => (current === "asc" ? "desc" : "asc"))
      return
    }
    setSort(key)
    // Posição é melhor quando menor; as outras três, quando maiores.
    setDir(key === "position" ? "asc" : "desc")
  }

  const shown = rows.slice(0, limit)

  return (
    <StepCard title="Keywords orgânicas">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <InputGroup className="min-w-0 max-w-xs flex-1 basis-44">
          <InputGroupAddon>
            <RiSearchLine size={16} aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id="visibility-keyword-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar keyword"
            aria-label="Buscar keyword"
          />
        </InputGroup>

        <div className="w-44 shrink-0">
          <Select
            items={INTENT_ITEMS}
            value={intent}
            onValueChange={(next) => setIntent(String(next))}
          >
            <SelectTrigger id="visibility-intent-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {INTENT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hosts.length > 1 ? (
          <div className="w-52 shrink-0">
            <Select
              items={hostItems}
              value={host}
              onValueChange={(next) => setHost(String(next))}
            >
              <SelectTrigger id="visibility-host-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {hostItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div
          role="group"
          aria-label="Faixa de posição"
          className="flex shrink-0 items-center gap-1"
        >
          {BANDS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={band === item.id ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={band === item.id}
              className={band === item.id ? "" : "text-muted-foreground"}
              onClick={() => setBand(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* A tabela diz quanto do domínio ela cobre. Antes o card dizia 110 e a
          tabela listava 100, sem nada explicando a diferença. */}
      <p className="mb-2 text-xs/relaxed text-muted-foreground">
        Mostrando {formatVisibilityMetric(shown.length)} de{" "}
        {formatVisibilityMetric(rows.length)}
        {rows.length !== snapshot.keywords.length
          ? ` filtradas de ${formatVisibilityMetric(snapshot.keywords.length)}`
          : ""}
        {snapshot.coverage.truncated
          ? ` · amostra de ${formatVisibilityMetric(snapshot.coverage.total)} por tráfego`
          : ""}
        {snapshot.droppedRows > 0
          ? ` · ${snapshot.droppedRows} linha(s) ilegível(is) descartada(s)`
          : ""}
      </p>

      {shown.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma keyword com esses filtros.
        </p>
      ) : (
        <>
          {/* Tabela larga rola no próprio contêiner; a página nunca rola na
              horizontal. */}
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[42rem] border-collapse text-left">
              <TableHeader>
                <TableRow className="border-b border-border/70">
                  <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                    Keyword
                  </TableHead>
                  <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                    Intenção
                  </TableHead>
                  <SortableHead
                    label="Pos."
                    sortKey="position"
                    active={sort === "position"}
                    dir={dir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Tráfego"
                    sortKey="traffic"
                    active={sort === "traffic"}
                    dir={dir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Volume"
                    sortKey="volume"
                    active={sort === "volume"}
                    dir={dir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Dificuldade"
                    sortKey="difficulty"
                    active={sort === "difficulty"}
                    dir={dir}
                    onSort={handleSort}
                  />
                  <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                    URL
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => {
                  const previous = row.position.previous
                  const current = row.position.value
                  const moved =
                    previous !== null &&
                    current !== null &&
                    previous !== current
                  const up = moved && current < previous
                  return (
                    <TableRow
                      key={row.keyword}
                      className={cn(
                        "border-b border-border/50 last:border-b-0",
                        isVisibilityRowStale(
                          row.position.updatedAt,
                          snapshot.collectedAt,
                        ) && "opacity-60",
                      )}
                    >
                      <TableCell className="max-w-[16rem] px-1 py-2 text-xs/relaxed text-foreground">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{row.keyword}</span>
                          <RowFlags
                            flags={visibilityRowFlags(
                              row,
                              snapshot.collectedAt,
                            )}
                          />
                        </span>
                      </TableCell>
                      <TableCell className="px-1 py-2 text-xs/relaxed text-muted-foreground">
                        <span title={visibilityIntentDetail(row.intent)}>
                          {visibilityIntentLabel(row.intent)}
                        </span>
                      </TableCell>
                      <TableCell
                        className="px-1 py-2 text-xs/relaxed text-foreground"
                        title={
                          row.position.updatedAt
                            ? `Índice de ${formatDate(row.position.updatedAt)}`
                            : "Data do índice não informada"
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {formatVisibilityMetric(current)}
                          {moved ? (
                            <RiArrowRightUpLine
                              size={11}
                              aria-label={
                                up
                                  ? `Subiu de ${previous}`
                                  : `Caiu de ${previous}`
                              }
                              className={cn(
                                "shrink-0",
                                up
                                  ? "text-success"
                                  : "rotate-90 text-muted-foreground",
                              )}
                            />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                        {formatVisibilityMetric(row.traffic, 1)}
                      </TableCell>
                      <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                        {formatVisibilityMetric(row.volume.value)}
                      </TableCell>
                      <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                        {/* Índice 0–100, não percentual. O `%` de antes era erro
                            de unidade, e o `0` era ausência com cara de medida. */}
                        {row.difficulty.index === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          row.difficulty.index.toLocaleString("pt-BR")
                        )}
                        {row.difficulty.adsCompetition ? (
                          <span className="ml-1.5 text-muted-foreground">
                            {visibilityAdsCompetitionLabel(
                              row.difficulty.adsCompetition,
                            )}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate px-1 py-2 text-xs/relaxed text-muted-foreground">
                        {row.url ? (
                          <span title={row.url.full ?? row.url.path}>
                            {/* O host só aparece quando não é o principal: é a
                                informação nova, e repetir `www.` em toda linha
                                seria ruído. */}
                            {row.url.isCanonicalHost === false &&
                            row.url.host ? (
                              <span className="text-warning">
                                {row.url.host}
                              </span>
                            ) : null}
                            {row.url.path}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {rows.length > shown.length ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setLimit((current) => current + PAGE)}
            >
              Ver mais {Math.min(PAGE, rows.length - shown.length)}
            </Button>
          ) : null}
        </>
      )}
    </StepCard>
  )
}
