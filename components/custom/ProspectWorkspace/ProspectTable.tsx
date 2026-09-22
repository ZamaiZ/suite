"use client"

import { useMemo, useState } from "react"
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiSearchLine,
} from "react-icons/ri"
import { cn } from "cn"

import { CONFIDENCE_BAND_LABEL } from "@/lib/prospect/cnpj-match"
import { TEMPERATURE_LABEL } from "@/lib/prospect/score"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"

import {
  PROSPECT_FILTERS,
  type ProspectFilterId,
  type ProspectRow,
  type ProspectSortKey,
} from "./ProspectWorkspace.types"

/**
 * A lista de empresas descobertas.
 *
 * Tabela à mão sobre `components/ui/table.tsx`, no padrão de
 * `LeadVisibilityKeywordsTable`: busca com folding de acento, filtros por
 * faixa, cabeçalho ordenável com `aria-sort`, e "ver mais" a cada 50 em vez de
 * paginação — mil linhas de uma vez não se lê.
 *
 * A seleção de linha é nova no repositório: nenhuma tabela tinha, e aqui ela é
 * o mecanismo central, porque o funil inteiro é o SDR estreitando a lista.
 */

const PAGE = 50
const NUM = new Intl.NumberFormat("pt-BR")

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

const BAND_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  confirmed: "default",
  likely: "secondary",
  uncertain: "outline",
  none: "outline",
}

export function ProspectTable({
  rows,
  selected,
  onSelectedChange,
  onOpen,
}: {
  rows: ProspectRow[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onOpen: (row: ProspectRow) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ProspectFilterId>("todas")
  const [sortKey, setSortKey] = useState<ProspectSortKey>("score")
  const [asc, setAsc] = useState(false)
  const [visible, setVisible] = useState(PAGE)

  const filtradas = useMemo(() => {
    const q = fold(query.trim())
    return rows.filter((r) => {
      if (q && !fold(`${r.title} ${r.category ?? ""} ${r.city ?? ""}`).includes(q)) {
        return false
      }
      switch (filter) {
        case "quentes":
          return r.score.temperature === "quente"
        case "sem_site":
          return !r.domain
        case "nao_reivindicado":
          return r.isClaimed === false
        case "com_cnpj":
          return Boolean(r.taxId)
        case "com_contato":
          return r.contacts.length > 0
        case "promovidas":
          return r.stage === "promoted"
        default:
          return r.stage !== "dismissed"
      }
    })
  }, [rows, query, filter])

  const ordenadas = useMemo(() => {
    const dir = asc ? 1 : -1
    return [...filtradas].sort((a, b) => {
      switch (sortKey) {
        case "rating":
          return ((a.rating ?? 0) - (b.rating ?? 0)) * dir
        case "votes":
          return ((a.votesCount ?? 0) - (b.votesCount ?? 0)) * dir
        case "title":
          return a.title.localeCompare(b.title, "pt-BR") * dir
        default:
          return (a.score.fit + a.score.reach - (b.score.fit + b.score.reach)) * dir
      }
    })
  }, [filtradas, sortKey, asc])

  const naTela = ordenadas.slice(0, visible)
  const todasMarcadas =
    naTela.length > 0 && naTela.every((r) => selected.has(r.id))

  function alternarTodas() {
    const next = new Set(selected)
    if (todasMarcadas) for (const r of naTela) next.delete(r.id)
    else for (const r of naTela) if (r.stage !== "promoted") next.add(r.id)
    onSelectedChange(next)
  }

  function alternar(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  function ordenarPor(key: ProspectSortKey) {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <RiSearchLine aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, categoria ou cidade"
            aria-label="Buscar empresa"
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-1">
          {PROSPECT_FILTERS.map((f) => (
            <Toggle
              key={f.id}
              size="sm"
              pressed={filter === f.id}
              onPressedChange={() => {
                setFilter(f.id)
                setVisible(PAGE)
              }}
            >
              {f.label}
            </Toggle>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {NUM.format(ordenadas.length)}{" "}
          {ordenadas.length === 1 ? "empresa" : "empresas"}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={todasMarcadas}
                onCheckedChange={alternarTodas}
                aria-label="Selecionar todas as visíveis"
              />
            </TableHead>
            <Ordenavel
              label="Empresa"
              active={sortKey === "title"}
              asc={asc}
              onClick={() => ordenarPor("title")}
            />
            <TableHead>Sinais</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Contato</TableHead>
            <Ordenavel
              label="Nota"
              align="right"
              active={sortKey === "rating"}
              asc={asc}
              onClick={() => ordenarPor("rating")}
            />
            <Ordenavel
              label="Temperatura"
              align="right"
              active={sortKey === "score"}
              asc={asc}
              onClick={() => ordenarPor("score")}
            />
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {naTela.map((r) => (
            <TableRow
              key={r.id}
              data-state={selected.has(r.id) ? "selected" : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(r.id)}
                  onCheckedChange={() => alternar(r.id)}
                  disabled={r.stage === "promoted"}
                  aria-label={`Selecionar ${r.title}`}
                />
              </TableCell>
              <TableCell>
                <span className="block truncate font-medium">{r.title}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {r.category ?? "—"}
                  {r.city ? ` · ${r.city}` : ""}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {r.isClaimed === false ? (
                    <Badge variant="secondary">sem perfil</Badge>
                  ) : null}
                  {!r.domain ? <Badge variant="secondary">sem site</Badge> : null}
                  {!r.votesCount ? (
                    <Badge variant="outline">sem avaliação</Badge>
                  ) : null}
                  {r.stage === "promoted" ? (
                    <Badge>promovida</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {r.taxId && r.taxIdBand !== "none" ? (
                  <div className="flex flex-col">
                    <Badge variant={BAND_VARIANT[r.taxIdBand]}>
                      {CONFIDENCE_BAND_LABEL[r.taxIdBand]}
                    </Badge>
                    {/* O motivo, nunca a porcentagem: "telefone confere" é
                        auditável por quem lê, "78%" não é. */}
                    {r.taxIdReason ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {r.taxIdReason}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {r.contacts.length > 0 ? (
                  <span className="text-xs tabular-nums">
                    {NUM.format(r.contacts.length)}{" "}
                    {r.contacts.length === 1 ? "canal" : "canais"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.rating === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    {r.rating.toFixed(1)}
                    <span className="text-muted-foreground block text-xs">
                      {NUM.format(r.votesCount ?? 0)}
                    </span>
                  </>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    r.score.temperature === "quente"
                      ? "default"
                      : r.score.temperature === "morno"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {TEMPERATURE_LABEL[r.score.temperature]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onOpen(r)}>
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {visible < ordenadas.length ? (
        <Button
          variant="outline"
          onClick={() => setVisible((v) => v + PAGE)}
          className="self-center"
        >
          Ver mais {NUM.format(Math.min(PAGE, ordenadas.length - visible))}
        </Button>
      ) : null}
    </div>
  )
}

function Ordenavel({
  label,
  active,
  asc,
  onClick,
  align = "left",
}: {
  label: string
  active: boolean
  asc: boolean
  onClick: () => void
  align?: "left" | "right"
}) {
  return (
    <TableHead
      // A direção é dita por ícone e por `aria-sort`, nunca por cor.
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
      className={align === "right" ? "text-right" : undefined}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          asc ? (
            <RiArrowUpLine aria-hidden className="size-3" />
          ) : (
            <RiArrowDownLine aria-hidden className="size-3" />
          )
        ) : null}
      </button>
    </TableHead>
  )
}
