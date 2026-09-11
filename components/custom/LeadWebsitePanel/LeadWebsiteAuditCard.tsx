"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiTimeLine,
} from "react-icons/ri"
import {
  StepCard,
  StepMeter,
  stepShareTone,
} from "@/components/custom/LeadStepShell"
import { cn } from "cn"
import {
  websiteCheckGroups,
  type WebsiteCheckItem,
  type WebsiteCheckSection,
  type WebsiteCheckStatus,
} from "@/lib/leads/website-presenters"

const STATUS_ICON = {
  ok: RiCheckboxCircleLine,
  warn: RiErrorWarningLine,
  pending: RiTimeLine,
  error: RiCloseCircleLine,
} as const

const STATUS_TONE: Record<WebsiteCheckStatus, string> = {
  ok: "text-success",
  warn: "text-warning",
  pending: "text-muted-foreground",
  error: "text-destructive",
}

function CheckRow({ item }: { item: WebsiteCheckItem }) {
  const Icon = STATUS_ICON[item.status]
  return (
    <li className="flex items-start gap-2 border-t border-border/70 py-2 first:border-t-0 first:pt-0">
      <Icon
        size={14}
        aria-hidden
        className={cn("mt-0.5 shrink-0", STATUS_TONE[item.status])}
      />
      <div className="min-w-0">
        <p className="text-xs/relaxed font-medium text-foreground">
          {item.label}
        </p>
        {/*
          Quando o detalhe é contagem, o número sai da frase: em cinza junto com
          o resto, ele não declara nada. `detail` continua sendo a fonte de quem
          não tem contagem.
        */}
        {item.count ? (
          <p className="text-xs/relaxed text-muted-foreground">
            <span
              className={cn(
                "text-[13px] font-semibold tabular-nums",
                STATUS_TONE[item.status],
              )}
            >
              {item.count.value.toLocaleString("pt-BR")}
            </span>{" "}
            {item.count.noun}
          </p>
        ) : (
          <p className="text-xs/relaxed text-muted-foreground">{item.detail}</p>
        )}
      </div>
    </li>
  )
}

/**
 * Um pilar da auditoria. O cabeçalho ganhou saldo — os cards diziam o estado de
 * cada item e nunca o do pilar — e os aprovados nascem recolhidos: o que precisa
 * de trabalho fica visível sem rolar, o que passou continua auditável.
 */
export function LeadWebsiteAuditCard({
  section,
}: {
  section: WebsiteCheckSection
}) {
  const reduced = !!useReducedMotion()
  const [approvedOpen, setApprovedOpen] = useState(false)
  const { open, approved } = websiteCheckGroups(section)
  const total = section.items.length
  const share = total > 0 ? approved.length / total : 0
  const listId = `website-audit-${section.id}-approved`

  return (
    <StepCard title={section.title}>
      <div className="-mt-1 mb-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">aprovados</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {approved.length.toLocaleString("pt-BR")} de{" "}
            {total.toLocaleString("pt-BR")}
          </span>
        </div>
        <StepMeter
          share={share}
          tone={stepShareTone(share)}
          className="mt-1"
          trackClassName="h-1"
        />
      </div>

      {open.length > 0 ? (
        <ul className="flex flex-col">
          {open.map((item) => (
            <CheckRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-xs/relaxed text-muted-foreground">
          Nada pendente neste pilar.
        </p>
      )}

      {approved.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setApprovedOpen((current) => !current)}
            aria-expanded={approvedOpen}
            aria-controls={listId}
            className="mt-2 cursor-pointer text-[11px] font-medium text-primary transition-colors duration-150 hover:text-primary/80"
          >
            {approvedOpen
              ? "Ocultar aprovados"
              : `Ver os ${approved.length.toLocaleString("pt-BR")} aprovados`}
          </button>
          <div
            id={listId}
            className={cn(
              "grid",
              reduced
                ? "transition-none"
                : "transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              approvedOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <ul className="flex flex-col pt-2">
                {approved.map((item) => (
                  <CheckRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </StepCard>
  )
}
