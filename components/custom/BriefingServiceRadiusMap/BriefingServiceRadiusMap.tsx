"use client"

import dynamic from "next/dynamic"
import type { BriefingServiceRadiusMapProps } from "./BriefingServiceRadiusMap.types"
import { Spinner } from "@/components/ui/spinner"

const BriefingServiceRadiusMapCanvas = dynamic(
  () =>
    import("./BriefingServiceRadiusMapCanvas").then(
      (mod) => mod.BriefingServiceRadiusMapCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center gap-2 rounded-xl border border-border bg-popover text-xs/relaxed text-muted-foreground sm:h-80">
        <Spinner aria-hidden className="size-4.5" />
        Carregando mapa…
      </div>
    ),
  },
)

export function BriefingServiceRadiusMap(props: BriefingServiceRadiusMapProps) {
  return <BriefingServiceRadiusMapCanvas {...props} />
}
