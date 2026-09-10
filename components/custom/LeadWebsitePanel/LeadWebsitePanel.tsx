"use client"

import { RiGlobalLine } from "react-icons/ri"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { LeadWebsiteView } from "./LeadWebsiteView"
import { useWebsiteController } from "./use-website-controller"
import type { LeadWebsitePanelProps } from "./LeadWebsitePanel.types"

/**
 * A etapa monta o próprio shell de tela cheia — cabeçalho fixo, abas e coluna
 * de oportunidades — em `LeadWebsiteView`. Aqui sobra o que é de fato deste
 * nível: escolher o canal e tratar os dois vazios.
 */
export function LeadWebsitePanel(props: LeadWebsitePanelProps) {
  const controller = useWebsiteController(props)

  if (!controller.selected) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <RiGlobalLine size={22} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhum site cadastrado neste lead.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  // Sem coleta o shell continua montado: o cabeçalho é onde mora o botão que
  // resolve o vazio, e cada aba mostra o próprio estado vazio no corpo.
  return (
    <LeadWebsiteView
      controller={controller}
      readingMode={props.readingMode ?? false}
    />
  )
}

/** Vazio de coleta, usado pelas abas enquanto não há auditoria do canal. */
export function LeadWebsiteEmptyAudit() {
  return (
    <Empty className="px-4 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 rounded-xl">
          <RiGlobalLine size={22} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Nenhuma coleta deste site</EmptyTitle>
        <EmptyDescription>
          Analise o website para montar a auditoria on-page.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
