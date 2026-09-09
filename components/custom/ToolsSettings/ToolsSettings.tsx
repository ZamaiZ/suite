"use client"

import { useMemo, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiAlertLine } from "react-icons/ri"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import {
  DATAFORSEO_OPERATIONS,
  dataForSeoOperationCost,
  formatUsd,
  type DataForSeoOperationId,
  type DataForSeoRateEntry,
} from "@/lib/dataforseo/usage"
import type { ToolsSettingsProps } from "./ToolsSettings.types"

// DATAFORSEO_OPERATIONS usa {id,label}; o Base UI espera {value,label}.
const OPERATION_ITEMS = DATAFORSEO_OPERATIONS.map((item) => ({
  value: item.id,
  label: item.label,
}))

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
          <p className="text-xs/relaxed font-medium uppercase tracking-widest text-muted-foreground">
            Configurações
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Ferramentas
          </h1>
          <p className="max-w-3xl text-xs/relaxed text-muted-foreground">
            O DataForSEO é a fonte de todas as coletas da auditoria. Saldo,
            consumo e preços vêm da própria conta — nada aqui é estimativa
            gravada no código.
          </p>
        </m.header>

        {!configured ? (
          <m.div variants={fadeUp}>
            <Alert>
              <RiAlertLine aria-hidden className="text-warning" />
              <AlertDescription>
                Credencial ausente. Defina{" "}
                <code className="font-mono text-xs/relaxed">
                  DATAFORSEO_LOGIN
                </code>{" "}
                e{" "}
                <code className="font-mono text-xs/relaxed">
                  DATAFORSEO_PASSWORD
                </code>{" "}
                para liberar as coletas.
              </AlertDescription>
            </Alert>
          </m.div>
        ) : null}

        {errorMessage ? (
          <m.p variants={fadeUp} className="text-xs/relaxed text-destructive">
            {errorMessage}
          </m.p>
        ) : null}

        {usage ? (
          <>
            <Card
              render={<m.section variants={fadeUp} />}
              className="sm:[--card-spacing:--spacing(6)]"
            >
              <CardHeader>
                <CardTitle render={<h2 />} className="font-semibold">
                  Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card
              render={<m.section variants={fadeUp} />}
              className="sm:[--card-spacing:--spacing(6)]"
            >
              <CardHeader>
                <CardTitle render={<h2 />} className="font-semibold">
                  Uso e limites
                </CardTitle>
                <CardDescription>
                  O limite por minuto é o que trava uma malha grande.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <RateGroup title="Por minuto" entries={usage.rates.minute} />
                  <RateGroup title="Por dia" entries={usage.rates.day} />
                </div>
              </CardContent>
            </Card>

            <Card
              render={<m.section variants={fadeUp} />}
              className="sm:[--card-spacing:--spacing(6)]"
            >
              <CardHeader>
                <CardTitle render={<h2 />} className="font-semibold">
                  Calculadora
                </CardTitle>
                <CardDescription>
                  Preço unitário lido da tabela da conta, não de valores fixos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="flex min-w-56 flex-col gap-1">
                    <span className="text-xs/relaxed text-muted-foreground">
                      Operação
                    </span>
                    <Select
                      items={OPERATION_ITEMS}
                      value={operationId}
                      onValueChange={(value) =>
                        setOperationId(value as DataForSeoOperationId)
                      }
                    >
                      <SelectTrigger
                        id="dataforseo-operation"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {DATAFORSEO_OPERATIONS.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="flex w-32 flex-col gap-1">
                    <span className="text-xs/relaxed text-muted-foreground">
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
                  <p className="mt-3 text-xs/relaxed text-muted-foreground">
                    A conta não expõe preço para{" "}
                    <code className="font-mono">
                      {estimate.operation.api}/{estimate.operation.fnSuffix}
                    </code>
                    . Verifique se a seção está habilitada no plano.
                  </p>
                ) : null}

                {estimate?.fn ? (
                  <p className="mt-3 text-xs/relaxed text-muted-foreground">
                    Preço lido da tabela da conta em{" "}
                    <code className="font-mono">
                      {estimate.operation.api}/{estimate.fn}
                    </code>
                    , prioridade normal.
                    {estimate.operation.caveat
                      ? ` ${estimate.operation.caveat}`
                      : null}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </m.div>
    </div>
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
      <dt className="text-xs/relaxed text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm tabular-nums",
          tone === "accent" && "font-semibold text-primary",
          tone === "warning" && "font-semibold text-warning",
          tone === "default" && "text-foreground",
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
        <h3 className="font-heading text-sm font-medium text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-xs/relaxed text-muted-foreground">
          Sem dados de limite.
        </p>
      </div>
    )
  }
  return (
    <div>
      <h3 className="font-heading text-sm font-medium text-foreground">
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {entries.map((entry) => {
          const ratio = usageRatio(entry)
          return (
            <li key={entry.api} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs/relaxed text-muted-foreground">
                  {apiLabel(entry.api)}
                </span>
                <span className="text-xs/relaxed tabular-nums text-muted-foreground">
                  {(entry.used ?? 0).toLocaleString("pt-BR")}
                  {entry.limit !== null
                    ? ` / ${entry.limit.toLocaleString("pt-BR")}`
                    : ""}
                </span>
              </div>
              {ratio !== null ? (
                <div className="h-1 overflow-hidden rounded-full bg-accent">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      ratio > 0.85 ? "bg-destructive" : "bg-primary",
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
