"use client"

import { useState } from "react"
import { RiCloseLine, RiExternalLinkLine } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { LeadGbpGridSection } from "./LeadGbpGridSection"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LeadGbpGridScan } from "@/lib/leads/gbp-grid"
import { cn } from "cn"
import { formatDate } from "@/lib/date-time"
import {
  GBP_RANK_KEYWORD_MAX_LEN,
  GBP_RANK_KEYWORDS_MAX,
  type GbpRankCheck,
} from "@/lib/leads/gbp-audit"

function sameKeywords(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((keyword, index) => keyword === right[index])
}

function positionLabel(position: number | null): string {
  if (position === null) return "Fora do top 20"
  return `${position.toLocaleString("pt-BR")}º`
}

function positionTone(position: number | null): string {
  if (position === null) return "bg-accent text-muted-foreground"
  if (position <= 3) return "bg-success/10 text-success"
  if (position <= 10) return "bg-warning/10 text-warning"
  return "bg-accent text-muted-foreground"
}

function checkForKeyword(
  checks: GbpRankCheck[],
  keyword: string,
): GbpRankCheck | null {
  const folded = keyword.toLowerCase()
  return checks.find((check) => check.keyword.toLowerCase() === folded) ?? null
}

export function LeadGbpRankBlock({
  profileId,
  keywords,
  checks,
  gridScan,
  canEdit,
  pending,
  onSave,
  onCheck,
}: {
  profileId: string
  keywords: string[]
  checks: GbpRankCheck[]
  gridScan: LeadGbpGridScan | null
  canEdit: boolean
  pending: boolean
  onSave: (keywords: string[]) => Promise<void>
  onCheck: () => Promise<void>
}) {
  const [draft, setDraft] = useState(keywords)
  const [input, setInput] = useState("")

  // Reset ligado à mudança de chave: no render, não em efeito.
  const [syncedKeywords, setSyncedKeywords] = useState(keywords)
  if (syncedKeywords !== keywords) {
    setSyncedKeywords(keywords)
    setDraft(keywords)
    setInput("")
  }

  const dirty = !sameKeywords(draft, keywords)
  const canAdd = draft.length < GBP_RANK_KEYWORDS_MAX

  function addKeywordToDraft(current: string[]): string[] {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length > GBP_RANK_KEYWORD_MAX_LEN) return current
    const folded = trimmed.toLowerCase()
    if (current.some((keyword) => keyword.toLowerCase() === folded)) {
      return current
    }
    if (current.length >= GBP_RANK_KEYWORDS_MAX) return current
    return [...current, trimmed]
  }

  async function handleCheck() {
    if (pending) return
    let next = draft
    if (input.trim()) {
      next = addKeywordToDraft(draft)
      setDraft(next)
      setInput("")
    }
    try {
      if (!sameKeywords(next, keywords)) {
        await onSave(next)
      }
      if (next.length === 0) return
      await onCheck()
    } catch {
      return
    }
  }

  return (
    <LeadGbpCard title="Ranking no Maps">
      {draft.length === 0 && !canEdit ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhum termo salvo
        </p>
      ) : null}

      {draft.length > 0 ? (
        <Table className="w-full min-w-[28rem] border-collapse text-left">
          <TableHeader>
            <TableRow className="border-b border-border/70">
              <TableHead className="pb-2 text-xs/relaxed font-medium text-muted-foreground">
                Termo
              </TableHead>
              <TableHead className="pb-2 text-xs/relaxed font-medium text-muted-foreground">
                Posição
              </TableHead>
              <TableHead className="pb-2 text-xs/relaxed font-medium text-muted-foreground">
                Data
              </TableHead>
              <TableHead className="pb-2 text-xs/relaxed font-medium text-muted-foreground">
                Concorrentes
              </TableHead>
              <TableHead className="pb-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.map((keyword) => {
              const check = checkForKeyword(checks, keyword)
              return (
                <TableRow
                  key={keyword}
                  className="border-b border-border/70 last:border-b-0"
                >
                  <TableCell className="py-2 pr-3 text-xs/relaxed text-foreground">
                    <span className="inline-flex items-center gap-1">
                      {keyword}
                      {canEdit ? (
                        <button
                          type="button"
                          aria-label={`Remover ${keyword}`}
                          onClick={() =>
                            setDraft((current) =>
                              current.filter((item) => item !== keyword),
                            )
                          }
                          className="inline-flex size-4 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                        >
                          <RiCloseLine size={12} aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 pr-3">
                    {check ? (
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-xs/relaxed font-medium",
                          positionTone(check.maps_position),
                        )}
                      >
                        {positionLabel(check.maps_position)}
                      </span>
                    ) : (
                      <span className="text-xs/relaxed text-muted-foreground">
                        Sem consulta
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 pr-3 text-xs/relaxed text-muted-foreground">
                    {check ? formatDate(check.checked_at) : "—"}
                  </TableCell>
                  <TableCell className="py-2 pr-3 text-xs/relaxed text-muted-foreground">
                    {check && check.competitors.length > 0
                      ? check.competitors
                          .map((competitor) => competitor.title)
                          .join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    {check?.check_url ? (
                      <a
                        href={check.check_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs/relaxed font-medium text-primary hover:text-primary"
                      >
                        Maps
                        <RiExternalLinkLine size={12} aria-hidden />
                      </a>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhum termo para checar ranking.
        </p>
      )}

      {canEdit ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={input}
            maxLength={GBP_RANK_KEYWORD_MAX_LEN}
            disabled={!canAdd || pending}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              void handleCheck()
            }}
            placeholder={
              canAdd
                ? "Adicionar termo para checar ranking"
                : "Máximo de 3 termos"
            }
            className="h-7 min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
            disabled={pending || (!input.trim() && draft.length === 0)}
            onClick={() => {
              void handleCheck()
            }}
          >
            {pending ? <Spinner aria-hidden className="size-4" /> : null}
            Checar ranking
          </Button>
        </div>
      ) : null}

      {canEdit && dirty && !input.trim() ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              void onSave(draft).catch(() => undefined)
            }}
          >
            Salvar termos
          </Button>
        </div>
      ) : null}

      <LeadGbpGridSection
        profileId={profileId}
        keywords={keywords}
        initialScan={gridScan}
        canEdit={canEdit}
      />
    </LeadGbpCard>
  )
}
