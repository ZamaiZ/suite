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
  review,
  canEdit,
  onProfileChange,
  onPendingChange,
}: {
  profileId: string
  companyName: string
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
          {answered} de {GBP_DIRECTORIES.length} respondidos. Não há checagem
          automática, e não por falta de tentativa: diretório publica ficha e
          quase nunca emite link rastreável — 399 domínios de referência medidos
          num perfil real, zero diretórios — e a busca por operador não é
          honrada de forma confiável. O link abre a busca pelo nome, e o NAP só
          o analista julga.
        </p>
        <ul className="flex flex-col gap-1.5">
          {GBP_DIRECTORIES.map((item) => {
            const answer = review.directories[item.id]
            // Todo diretório é manual agora: o link é sempre a busca que o
            // analista teria que digitar.
            const href = gbpDirectorySearchUrl(item.domain, companyName)
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
