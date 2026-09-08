import type { IconType } from "react-icons"
import {
  RiCameraLine,
  RiMessage3Line,
  RiStarFill,
  RiTrophyLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  bestMapsPosition,
  formatGbpCount,
  formatGbpRating,
  gbpPhotosLabel,
} from "@/lib/leads/gbp-presenters"

function MetricCard({
  icon,
  label,
  value,
  complement,
}: {
  icon: IconType
  label: string
  value: string | null
  complement: string
}) {
  return (
    <div className="flex min-h-16 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2">
      <LeadIconWell icon={icon} />
      <div className="min-w-0">
        <p className="text-xs/relaxed text-muted-foreground">{label}</p>
        <p className="text-xs/relaxed font-semibold text-foreground">
          {value ?? "—"}
          {value ? (
            <span className="ml-1 font-normal text-muted-foreground">
              {complement}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

export function LeadGbpSummaryCards({ profile }: { profile: LeadGbpProfile }) {
  const rating = formatGbpRating(profile.payload.rating)
  const reviews = formatGbpCount(profile.payload.userRatingCount)
  const photos = gbpPhotosLabel(profile)
  const position = bestMapsPosition(profile.rank_keywords, profile.rankChecks)

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard
        icon={RiStarFill}
        label="Nota no Google"
        value={rating}
        complement="de 5"
      />
      <MetricCard
        icon={RiMessage3Line}
        label="Avaliações"
        value={reviews}
        complement="no total"
      />
      <MetricCard
        icon={RiCameraLine}
        label="Fotos"
        value={photos.value}
        complement={photos.complement}
      />
      <MetricCard
        icon={RiTrophyLine}
        label="Melhor posição"
        value={
          position !== null ? `${position.toLocaleString("pt-BR")}º` : null
        }
        complement="no Maps"
      />
    </div>
  )
}
