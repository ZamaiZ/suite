"use client"

import { LeadDigitalPresenceView } from "./LeadDigitalPresenceView"
import { useDigitalPresenceController } from "./use-digital-presence-controller"
import type { LeadDigitalPresencePanelProps } from "./LeadDigitalPresencePanel.types"

/**
 * A etapa monta o próprio shell de tela cheia — cabeçalho fixo, abas e coluna
 * de oportunidades — em `LeadDigitalPresenceView`. Aqui sobra só a ligação com
 * o controller.
 *
 * Sem vazio de nível de etapa: sem rede cadastrada e sem coleta do site, o
 * shell continua montado e cada aba mostra o próprio vazio. O cabeçalho é onde
 * mora a leitura que explica o que falta.
 */
export function LeadDigitalPresencePanel(props: LeadDigitalPresencePanelProps) {
  const controller = useDigitalPresenceController(props)
  return (
    <LeadDigitalPresenceView
      controller={controller}
      readingMode={props.readingMode ?? false}
    />
  )
}
