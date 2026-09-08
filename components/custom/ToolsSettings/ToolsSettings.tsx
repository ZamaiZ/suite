"use client"

import { useMemo, useState } from "react"
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiAlertLine } from "react-icons/ri"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/cn"
import {
  DATAFORSEO_OPERATIONS,
  dataForSeoOperationCost,
  formatUsd,
  type DataForSeoOperationId,
  type DataForSeoRateEntry,
} from "@/lib/dataforseo/usage"
import type { ToolsSettingsProps } from "./ToolsSettings.types"

const EASE = [0.23, 1, 0.32, 1] as const

const API_LABELS: Record<string, string> = {
  serp: "SERP",
  business_data: "Business Data",
  dataforseo_labs: "Labs",
  keywords_data: "Keywords Data",
  backlinks: "Backlinks",
  on_page: "On-Page",
  domain_analytics: "Domain Analytics",
  content_analysis: "Content Analysis",
  merchant: "Merchant",
  app_data: "App Data",
  ai_optimization: "AI Optimization",
  appendix: "Appendix",
}

function apiLabel(api: string): string {
  return API_LABELS[api] ?? api.replace(/_/g, " ")
}

function usageRatio(entry: DataForSeoRateEntry): number | null {
  if (entry.limit === null || entry.limit <= 0 || entry.used === null) {
    return null
  }
  return Math.min(entry.used / entry.limit, 1)
}

export function ToolsSettings({
  configured,
  usage,
  errorMessage,
}: ToolsSettingsProps) {
  const reduced = !!useReducedMotion()
  const [operationId, setOperationId] =
    useState<DataForSeoOperationId>("grid_5")
  const [quantity, setQuantity] = useState(1)

  const fadeUp = reduced
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.15 } },
      }
    : {
        hidden: { opacity: 0, transform: "translateY(8px)" },
        show: {
          opacity: 1,
          transform: "translateY(0px)",
          transition: { duration: 0.18, ease: EASE },
        },
      }

  const estimate = useMemo(() => {
    const operation =
      DATAFORSEO_OPERATIONS.find((item) => item.id === operationId) ??
      DATAFORSEO_OPERATIONS[0]
    if (!operation) return null
    return dataForSeoOperationCost(operation, usage?.prices ?? [], quantity)
  }, [operationId, quantity, usage?.prices])

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="px-[var(--page-padding-x)] py-8">
        <m.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduced ? 0 : 0.12 } },
          }}
          className="mx-auto flex max-w-6xl flex-col gap-6"
        >
          <m.header variants={fadeUp} className="flex flex-col gap-1">
            <p className="font-sans text-caption font-medium uppercase tracking-widest text-fg-muted">
              Configurações
            </p>
            <h1 className="font-display text-display font-semibold text-fg">
              Ferramentas
            </h1>
            <p className="max-w-3xl font-sans text-body-sm text-fg-secondary">
              O DataForSEO é a fonte de todas as coletas da auditoria. Saldo,
              consumo e preços vêm da própria conta — nada aqui é estimativa
              gravada no código.
            </p>
          </m.header>

          {!configured ? (
            <m.div
              variants={fadeUp}
              className="flex items-start gap-2 rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <RiAlertLine aria-hidden className="mt-0.5 size-4 text-warning" />
              <p className="font-sans text-body-sm text-fg-secondary">
                Credencial ausente. Defina{" "}
                <code className="font-mono text-caption">DATAFORSEO_LOGIN</code>{" "}
                e{" "}
                <code className="font-mono text-caption">
                  DATAFORSEO_PASSWORD
                </code>{" "}
                para liberar as coletas.
              </p>
            </m.div>
          ) : null}

          {errorMessage ? (
            <m.p variants={fadeUp} className="font-sans text-body-sm text-danger">
              {errorMessage}
            </m.p>
          ) : null}

          {usage ? (
            <>
              <m.section
                variants={fadeUp}
                className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-6"
              >
                <h2 className="font-sans text-body font-semibold text-fg">
                  Saldo
                </h2>
                <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                  <Stat
                    label="Disponível"
                    value={formatUsd(usage.money.balance)}
                    tone={
                      usage.money.balance !== null && usage.money.balance < 5
                        ? "warning"
                        : "default"
                    }
                  />
                  <Stat
                    label="Depositado"
                    value={formatUsd(usage.money.total)}
                  />
                  <Stat label="Conta" value={usage.login ?? "—"} />
                </dl>
                {Object.keys(usage.money.statistics).length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {Object.entries(usage.money.statistics).map(
                      ([period, value]) => (
                        <Stat
                          key={period}
                          label={`Gasto · ${period}`}
                          value={formatUsd(value)}
                        />
                      ),
                    )}
                  </div>
                ) : null}
              </m.section>

              <m.section
                variants={fadeUp}
                className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-6"
              >
                <h2 className="font-sans text-body font-semibold text-fg">
                  Uso e limites
                </h2>
                <p className="mt-1 font-sans text-caption text-fg-muted">
                  O limite por minuto é o que trava uma malha grande.
                </p>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <RateGroup title="Por minuto" entries={usage.rates.minute} />
                  <RateGroup title="Por dia" entries={usage.rates.day} />
                </div>
              </m.section>

              <m.section
                variants={fadeUp}
                className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-6"
              >
                <h2 className="font-sans text-body font-semibold text-fg">
                  Calculadora
                </h2>
                <p className="mt-1 font-sans text-caption text-fg-muted">
                  Preço unitário lido da tabela da conta, não de valores fixos.
                </p>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="flex min-w-56 flex-col gap-1">
                    <span className="font-sans text-caption text-fg-muted">
                      Operação
                    </span>
                    <Select
                      id="dataforseo-operation"
                      items={DATAFORSEO_OPERATIONS.map((item) => ({
                        value: item.id,
                        label: item.label,
                        description: item.detail,
                      }))}
                      value={operationId}
                      searchable={false}
                      onValueChange={(value) => {
                        const next = Array.isArray(value) ? value[0] : value
                        if (next) setOperationId(next as DataForSeoOperationId)
                      }}
                    />
                  </label>

                  <label className="flex w-32 flex-col gap-1">
                    <span className="font-sans text-caption text-fg-muted">
                      Quantidade
                    </span>
                    <Input
                      id="dataforseo-quantity"
                      type="number"
                      min={1}
                      value={String(quantity)}
                      onChange={(event) =>
                        setQuantity(
                          Math.max(Number(event.target.value) || 0, 0),
                        )
                      }
                    />
                  </label>
                </div>

                {estimate ? (
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Stat
                      label="Requisições"
                      value={estimate.requests.toLocaleString("pt-BR")}
                    />
                    <Stat
                      label="Preço unitário"
                      value={formatUsd(estimate.unitCost)}
                    />
                    <Stat
                      label="Custo estimado"
                      value={formatUsd(estimate.totalCost)}
                      tone="accent"
                    />
                  </dl>
                ) : null}

                {estimate && estimate.unitCost === null ? (
                  <p className="mt-3 font-sans text-caption text-fg-muted">
                    A conta não expõe preço para{" "}
                    <code className="font-mono">
                      {estimate.operation.api}/{estimate.operation.fnSuffix}
                    </code>
                    . Verifique se a seção está habilitada no plano.
                  </p>
                ) : null}
              </m.section>
            </>
          ) : null}
        </m.div>
      </div>
    </LazyMotion>
  )
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "accent" | "warning"
}) {
  return (
    <div className="flex flex-col">
      <dt className="font-sans text-caption text-fg-muted">{label}</dt>
      <dd
        className={cn(
          "font-sans text-body tabular-nums",
          tone === "accent" && "font-semibold text-accent",
          tone === "warning" && "font-semibold text-warning",
          tone === "default" && "text-fg",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function RateGroup({
  title,
  entries,
}: {
  title: string
  entries: DataForSeoRateEntry[]
}) {
  if (entries.length === 0) {
    return (
      <div>
        <h3 className="font-sans text-body-sm font-medium text-fg">{title}</h3>
        <p className="mt-2 font-sans text-caption text-fg-muted">
          Sem dados de limite.
        </p>
      </div>
    )
  }
  return (
    <div>
      <h3 className="font-sans text-body-sm font-medium text-fg">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {entries.map((entry) => {
          const ratio = usageRatio(entry)
          return (
            <li key={entry.api} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-caption text-fg-secondary">
                  {apiLabel(entry.api)}
                </span>
                <span className="font-sans text-caption tabular-nums text-fg-muted">
                  {(entry.used ?? 0).toLocaleString("pt-BR")}
                  {entry.limit !== null
                    ? ` / ${entry.limit.toLocaleString("pt-BR")}`
                    : ""}
                </span>
              </div>
              {ratio !== null ? (
                <div className="h-1 overflow-hidden rounded-full bg-hover">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      ratio > 0.85 ? "bg-danger" : "bg-accent",
                    )}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
