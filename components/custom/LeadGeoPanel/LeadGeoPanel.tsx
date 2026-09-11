"use client"

import { LeadGeoView } from "./LeadGeoView"
import { useGeoController } from "./use-geo-controller"
import type { LeadGeoPanelProps } from "./LeadGeoPanel.types"

/**
 * Casca fina: monta o controller e delega. Todo o estado mora em
 * `use-geo-controller`, e a composição da tela em `LeadGeoView` — mesmo
 * desenho das outras quatro etapas de auditoria.
 */
export function LeadGeoPanel(props: LeadGeoPanelProps) {
  const controller = useGeoController(props)
  return <LeadGeoView controller={controller} readingMode={props.readingMode} />
}
