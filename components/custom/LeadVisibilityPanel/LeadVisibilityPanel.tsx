"use client"

import { LeadVisibilityView } from "./LeadVisibilityView"
import { useVisibilityController } from "./use-visibility-controller"
import type { LeadVisibilityPanelProps } from "./LeadVisibilityPanel.types"

/**
 * Casca fina: monta o controller e delega. Todo o estado mora em
 * `use-visibility-controller`, e a composição da tela em `LeadVisibilityView` —
 * mesmo desenho das outras três etapas de auditoria.
 */
export function LeadVisibilityPanel(props: LeadVisibilityPanelProps) {
  const controller = useVisibilityController(props)
  return (
    <LeadVisibilityView
      controller={controller}
      readingMode={props.readingMode}
    />
  )
}
