"use client"

import { useState, useTransition } from "react"
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCheckLine, RiLoader4Line } from "react-icons/ri"
import { updateGbpDataProvider } from "@/app/actions/settings"
import { Select, type SelectItem } from "@/components/ui/Select"
import {
  isGbpDataProvider,
  type GbpDataProvider,
} from "@/lib/gbp-vendor"
import type { ToolsSettingsProps } from "./ToolsSettings.types"

const EASE = [0.23, 1, 0.32, 1] as const

const PROVIDER_ITEMS: SelectItem[] = [
  {
    value: "dataforseo",
    label: "DataForSEO",
    description: "Info live, avaliações, posts e ranking Maps",
  },
  {
    value: "serpapi",
    label: "SerpAPI",
    description: "1 consulta por análise; ranking separado",
  },
]

function configuredLabel(configured: boolean): string {
  return configured ? "Configurado" : "Chave ausente"
}

export function ToolsSettings({
  selected,
  dataForSeoConfigured,
  serpApiConfigured,
  serpApiQuota,
  currentUserIsAdmin,
}: ToolsSettingsProps) {
  const reduced = !!useReducedMotion()
  const [value, setValue] = useState<GbpDataProvider | null>(selected)
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

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

  function handleProviderChange(next: string | string[]) {
    const provider = Array.isArray(next) ? next[0] : next
    if (!isGbpDataProvider(provider)) return
    const previous = value
    setValue(provider)
    setMessage(null)
    setSaved(false)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("provider", provider)
      const result = await updateGbpDataProvider(formData)
      if (result.status === "error") {
        setValue(previous)
        setMessage(result.message)
        return
      }
      setSaved(true)
    })
  }

  const quotaLabel = serpApiQuota
    ? `${serpApiQuota.planSearchesLeft.toLocaleString("pt-BR")} de ${serpApiQuota.searchesPerMonth.toLocaleString("pt-BR")} restantes neste mês`
    : null

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="px-[var(--page-padding-x)] py-8">
        <m.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: reduced ? 0 : 0.16 },
            },
          }}
          className="mx-auto flex max-w-6xl flex-col gap-6"
        >
          <m.header
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: reduced ? 0 : 0.05 },
              },
            }}
            className="flex flex-col gap-1"
          >
            <m.p
              variants={fadeUp}
              className="font-sans text-caption font-medium uppercase tracking-widest text-fg-muted"
            >
              Configurações
            </m.p>
            <m.h1
              variants={fadeUp}
              className="font-display text-display font-semibold text-fg"
            >
              Ferramentas
            </m.h1>
            <m.p
              variants={fadeUp}
              className="max-w-3xl font-sans text-body-sm text-fg-secondary"
            >
              Fonte dos dados de análise do Google Business Profile. Só
              administradores alteram. Analisar perfil = 1 consulta; cada termo
              de ranking = 1; repetir o mesmo lugar em até 1h não conta.
            </m.p>
          </m.header>

          <m.div
            variants={fadeUp}
            className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-6"
          >
            <Select
              id="gbp-data-provider"
              items={PROVIDER_ITEMS}
              value={value ?? undefined}
              onValueChange={handleProviderChange}
              searchable={false}
              disabled={!currentUserIsAdmin || pending}
              label="Fonte de dados"
              placeholder="Selecionar"
              error={message ?? undefined}
            />

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-sans text-caption text-fg-muted">
                  DataForSEO
                </dt>
                <dd className="font-sans text-body-sm text-fg">
                  {configuredLabel(dataForSeoConfigured)}
                </dd>
              </div>
              <div>
                <dt className="font-sans text-caption text-fg-muted">SerpAPI</dt>
                <dd className="font-sans text-body-sm text-fg">
                  {configuredLabel(serpApiConfigured)}
                </dd>
              </div>
            </dl>

            {quotaLabel ? (
              <p className="font-sans text-body-sm text-fg-secondary">
                SerpAPI: {quotaLabel}
              </p>
            ) : null}

            {pending ? (
              <p className="inline-flex items-center gap-2 font-sans text-caption text-fg-muted">
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
                Salvando
              </p>
            ) : null}
            {!pending && saved && !message ? (
              <p className="inline-flex items-center gap-2 font-sans text-caption text-success">
                <RiCheckLine size={16} aria-hidden />
                Fonte salva
              </p>
            ) : null}
          </m.div>
        </m.div>
      </div>
    </LazyMotion>
  )
}
