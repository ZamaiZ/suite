"use client"

import { useEffect, useState } from "react"
import {
  RiCloseLine,
  RiExternalLinkLine,
  RiLoader4Line,
} from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"
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
  if (position === null) return "bg-hover text-fg-muted"
  if (position <= 3) return "bg-success/10 text-success"
  if (position <= 10) return "bg-warning/10 text-warning"
  return "bg-hover text-fg-muted"
}

function checkForKeyword(
  checks: GbpRankCheck[],
  keyword: string,
): GbpRankCheck | null {
  const folded = keyword.toLowerCase()
  return (
    checks.find((check) => check.keyword.toLowerCase() === folded) ?? null
  )
}

export function LeadGbpRankBlock({
  keywords,
  checks,
  canEdit,
  pending,
  onSave,
  onCheck,
}: {
  keywords: string[]
  checks: GbpRankCheck[]
  canEdit: boolean
  pending: boolean
  onSave: (keywords: string[]) => Promise<void>
  onCheck: () => Promise<void>
}) {
  const [draft, setDraft] = useState(keywords)
  const [input, setInput] = useState("")

  useEffect(() => {
    setDraft(keywords)
    setInput("")
  }, [keywords])

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
        <p className="font-sans text-caption text-fg-muted">
          Nenhum termo salvo
        </p>
      ) : null}

      {draft.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="pb-2 font-sans text-caption font-medium text-fg-muted">
                  Termo
                </th>
                <th className="pb-2 font-sans text-caption font-medium text-fg-muted">
                  Posição
                </th>
                <th className="pb-2 font-sans text-caption font-medium text-fg-muted">
                  Data
                </th>
                <th className="pb-2 font-sans text-caption font-medium text-fg-muted">
                  Concorrentes
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {draft.map((keyword) => {
                const check = checkForKeyword(checks, keyword)
                return (
                  <tr
                    key={keyword}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    <td className="py-2 pr-3 font-sans text-caption text-fg">
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
                            className="inline-flex size-4 cursor-pointer items-center justify-center rounded-sm text-fg-muted hover:text-fg"
                          >
                            <RiCloseLine size={12} aria-hidden />
                          </button>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {check ? (
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 font-sans text-caption font-medium",
                            positionTone(check.maps_position),
                          )}
                        >
                          {positionLabel(check.maps_position)}
                        </span>
                      ) : (
                        <span className="font-sans text-caption text-fg-muted">
                          Sem consulta
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-sans text-caption text-fg-muted">
                      {check ? formatDate(check.checked_at) : "—"}
                    </td>
                    <td className="py-2 pr-3 font-sans text-caption text-fg-secondary">
                      {check && check.competitors.length > 0
                        ? check.competitors
                            .map((competitor) => competitor.title)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="py-2">
                      {check?.check_url ? (
                        <a
                          href={check.check_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-sans text-caption font-medium text-link hover:text-accent"
                        >
                          Maps
                          <RiExternalLinkLine size={12} aria-hidden />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="font-sans text-caption text-fg-muted">
          Nenhum termo para checar ranking.
        </p>
      )}

      {canEdit ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
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
            className={cn(
              "h-[var(--control-height)] min-w-0 flex-1 rounded-md border border-input-border bg-input px-3",
              "font-sans text-body-sm text-fg outline-none",
              "placeholder:text-fg-muted",
              "focus-visible:border-accent",
              "disabled:opacity-50",
            )}
          />
          <Button
            type="button"
            variant="outline"
            className="border-accent/30 text-accent hover:bg-accent/10"
            disabled={pending || (!input.trim() && draft.length === 0)}
            onClick={() => {
              void handleCheck()
            }}
            leadingIcon={
              pending ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : null
            }
          >
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
    </LeadGbpCard>
  )
}
