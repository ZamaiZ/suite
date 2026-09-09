"use client"

import { useMemo, useState } from "react"
import { RiExternalLinkLine } from "react-icons/ri"
import { cn } from "cn"
import {
  updateLeadGbpAnalystReview,
  type LeadGbpProfile,
} from "@/app/actions/leads"
import { LeadGbpCard } from "./LeadGbpCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GBP_DIRECTORIES,
  GBP_DIRECTORY_STATE_LABELS,
  gbpDirectorySearchUrl,
  type GbpAnalystReview,
  type GbpDirectoryId,
  type GbpDirectoryState,
} from "@/lib/leads/gbp-analyst-review"
import type { BacklinkCitation } from "@/lib/leads/backlinks-audit"

const UNSET = "unset"

const STATE_ITEMS = [
  { value: UNSET, label: "Não verificado" },
  { value: "present", label: GBP_DIRECTORY_STATE_LABELS.present },
  { value: "absent", label: GBP_DIRECTORY_STATE_LABELS.absent },
  { value: "nap_mismatch", label: GBP_DIRECTORY_STATE_LABELS.nap_mismatch },
]

function stateTone(state: GbpDirectoryState | null): string {
  if (state === "present") return "text-success"
  if (state === "nap_mismatch") return "text-destructive"
  if (state === "absent") return "text-warning"
  return "text-muted-foreground"
}

/**
 * Citação local é o que backlinks não enxerga: NAP num diretório sem link
 * nenhum. Não há API para isso, então a lista é fixa e o analista confere.
 */
export function LeadGbpDirectoriesCard({
  profileId,
  companyName,
  citations,
  review,
  canEdit,
  onProfileChange,
  onPendingChange,
}: {
  profileId: string
  companyName: string
  /** `null` = checagem não feita; `[]` = feita e nenhum diretório linka. */
  citations: BacklinkCitation[] | null
  review: GbpAnalystReview
  canEdit: boolean
  onProfileChange: (profile: LeadGbpProfile) => void
  onPendingChange: (pending: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const answered = useMemo(
    () =>
      GBP_DIRECTORIES.filter((item) => review.directories[item.id].state)
        .length,
    [review],
  )
  const found = useMemo(() => {
    const map = new Map<string, BacklinkCitation>()
    for (const item of citations ?? []) map.set(item.directoryId, item)
    return map
  }, [citations])

  function handleChange(id: GbpDirectoryId, raw: string) {
    if (busy) return
    const state = raw === UNSET ? null : (raw as GbpDirectoryState)
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("profile_id", profileId)
    // Só o diretório alterado vai no corpo: o servidor preserva o resto e
    // carimba a data apenas nesta resposta.
    formData.set(
      "analyst_review",
      JSON.stringify({ directories: { [id]: state } }),
    )
    void updateLeadGbpAnalystReview(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onProfileChange(result.profile)
    })
  }

  return (
    <LeadGbpCard title="Diretórios e citações">
      <div className="flex flex-col gap-2">
        <p className="text-xs/relaxed text-muted-foreground">
          {answered} de {GBP_DIRECTORIES.length} respondidos
          {citations
            ? ` · ${found.size} com link na última análise de backlinks`
            : " · a checagem automática entra na próxima análise de backlinks"}
          . Link encontrado prova o cadastro; a ausência de link não prova a
          ausência dele, e o NAP só o analista julga.
        </p>
        <ul className="flex flex-col gap-1.5">
          {GBP_DIRECTORIES.map((item) => {
            const answer = review.directories[item.id]
            const citation = found.get(item.id)
            // Com a página do cadastro em mãos, o link vai direto para ela; sem
            // ela, sobra a busca `site:` que o analista teria que fazer.
            const href =
              citation?.url ??
              gbpDirectorySearchUrl(item.domain, companyName)
            const manualOnly = item.linkDomains.length === 0
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 text-xs/relaxed hover:underline",
                    stateTone(answer.state),
                  )}
                >
                  {item.label}
                  <RiExternalLinkLine size={12} aria-hidden />
                  {citation ? (
                    <span className="text-success">· link</span>
                  ) : null}
                  {manualOnly ? (
                    <span className="text-muted-foreground/70">· manual</span>
                  ) : null}
                </a>
                <Select
                  items={STATE_ITEMS}
                  value={answer.state ?? UNSET}
                  onValueChange={(value) =>
                    handleChange(item.id, String(value))
                  }
                  disabled={!canEdit || busy}
                >
                  <SelectTrigger
                    size="sm"
                    id={`gbp-directory-${profileId}-${item.id}`}
                    aria-label={`Situação em ${item.label}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {STATE_ITEMS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            )
          })}
        </ul>
        {error ? (
          <p role="alert" className="text-xs/relaxed text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </LeadGbpCard>
  )
}
