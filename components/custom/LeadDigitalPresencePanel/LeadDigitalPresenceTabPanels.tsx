"use client"

import { RiGlobalLine, RiGroupLine } from "react-icons/ri"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  emptyNetworkAnswer,
  type DigitalPresenceNetworkAnswer,
} from "@/lib/leads/digital-presence-review"
import { LeadDigitalPresenceNetworkCard } from "./LeadDigitalPresenceNetworkCard"
import {
  LeadDigitalPresenceBrand,
  LeadDigitalPresenceSiteLinksCard,
  LeadDigitalPresenceTracking,
} from "./LeadDigitalPresenceSiteCards"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

type PanelProps = {
  controller: DigitalPresenceController
  readingMode: boolean
}

export function LeadDigitalPresenceTabRedes({
  controller,
  readingMode,
}: PanelProps) {
  const { networkStates, review, canEdit, today } = controller

  function patch(
    channelId: string,
    partial: Partial<DigitalPresenceNetworkAnswer>,
  ) {
    const current = review.networks[channelId] ?? emptyNetworkAnswer()
    controller.handleReviewChange({
      ...review,
      networks: {
        ...review.networks,
        [channelId]: { ...current, ...partial },
      },
    })
  }

  if (networkStates.length === 0) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <RiGroupLine size={22} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhuma rede cadastrada</EmptyTitle>
          <EmptyDescription>
            Inclua Instagram, LinkedIn ou outras no cadastro do lead.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  /*
    Duas colunas de fluxo, não `grid-cols-2`: os chips de idade e de alinhamento
    entram e saem, as alturas naturais divergem, e o grid faria a linha tomar a
    altura do card mais alto, deixando vão embaixo do card curto.
  */
  const columns = [
    networkStates.filter((_, index) => index % 2 === 0),
    networkStates.filter((_, index) => index % 2 === 1),
  ]

  return (
    <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
      {columns.map((column, index) =>
        column.length === 0 ? null : (
          <div key={index} className="flex min-w-0 flex-1 flex-col gap-3.5">
            {column.map((state) => (
              <LeadDigitalPresenceNetworkCard
                key={state.channelId}
                state={state}
                canEdit={canEdit && !readingMode}
                today={today}
                onChange={patch}
              />
            ))}
          </div>
        ),
      )}
    </div>
  )
}

export function LeadDigitalPresenceTabSite({
  controller,
  readingMode,
}: PanelProps) {
  const { signals, siteLinks, review, canEdit, syncKey } = controller

  // Sem coleta, a aba inteira é o vazio: é assim que a ressalva sai do rodapé
  // da página e vira o conteúdo dela.
  if (!signals || !siteLinks) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <RiGlobalLine size={22} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Sem coleta do site</EmptyTitle>
          <EmptyDescription>
            A coleta do Website alimenta esta aba. Analise o site para preencher
            rastreamento e alinhamento.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <LeadDigitalPresenceTracking signals={signals} />
        <LeadDigitalPresenceBrand
          reviewKey={syncKey}
          review={review}
          canEdit={canEdit && !readingMode}
          onChange={controller.handleReviewChange}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <LeadDigitalPresenceSiteLinksCard links={siteLinks} />
      </div>
    </div>
  )
}
