"use client"

import dynamic from "next/dynamic"
import { RiLoader4Line } from "react-icons/ri"
import type { BriefingServiceRadiusMapProps } from "./BriefingServiceRadiusMap.types"

const BriefingServiceRadiusMapCanvas = dynamic(
  () =>
    import("./BriefingServiceRadiusMapCanvas").then(
      (mod) => mod.BriefingServiceRadiusMapCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center gap-2 rounded-xl border border-border bg-elevated font-sans text-body-sm text-fg-muted sm:h-80">
        <RiLoader4Line size={18} aria-hidden className="animate-spin" />
        Carregando mapa…
      </div>
    ),
  },
)

export function BriefingServiceRadiusMap(props: BriefingServiceRadiusMapProps) {
  return <BriefingServiceRadiusMapCanvas {...props} />
}
