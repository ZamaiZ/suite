import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  bestMapsPosition,
  formatGbpCount,
  formatGbpRating,
  gbpPhotosLabel,
} from "@/lib/leads/gbp-presenters"

function MetricCell({
  label,
  value,
  complement,
}: {
  label: string
  value: string | null
  complement: string
}) {
  return (
    <div className="flex flex-col justify-center gap-0.5 rounded-lg bg-card px-3 py-2.5 ring-1 ring-foreground/10">
      <p className="text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-[20px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
        {value ?? "—"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {value ? complement : "sem dado"}
      </p>
    </div>
  )
}

/**
 * Sem `LeadIconWell`: na faixa do cabeçalho o número é o elemento, e o poço de
 * ícone competia com ele por atenção e por altura.
 */
export function LeadGbpMetricCells({ profile }: { profile: LeadGbpProfile }) {
  const photos = gbpPhotosLabel(profile)
  const position = bestMapsPosition(profile.rank_keywords, profile.rankChecks)

  return (
    <>
      <MetricCell
        label="Nota"
        value={formatGbpRating(profile.payload.rating)}
        complement="de 5"
      />
      <MetricCell
        label="Avaliações"
        value={formatGbpCount(profile.payload.userRatingCount)}
        complement="no total"
      />
      <MetricCell
        label="Fotos"
        value={photos.value}
        complement={photos.complement}
      />
      <MetricCell
        label="Melhor posição"
        value={position !== null ? `${position.toLocaleString("pt-BR")}º` : null}
        complement="no Maps"
      />
    </>
  )
}
