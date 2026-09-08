"use client"

import { useState, type ReactNode } from "react"
import type { IconType } from "react-icons"
import {
  RiAlertLine,
  RiBuilding4Line,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiGlobalLine,
  RiPhoneLine,
  RiStackLine,
  RiTimeLine,
} from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { formatPhone, toTelHref } from "@/lib/br-documents"
import { cn } from "cn"
import { canonicalWebsiteUrl } from "@/lib/leads/website"
import type { GbpGapId, LeadGbpProfile } from "@/lib/leads/gbp"
import {
  gbpBusinessStatusLabel,
  summarizeOpeningHours,
} from "@/lib/leads/gbp-presenters"

function FieldRow({
  icon,
  label,
  warning,
  children,
}: {
  icon: IconType
  label: string
  warning?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 py-2">
      <LeadIconWell
        icon={icon}
        className={warning ? "text-warning" : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs/relaxed text-muted-foreground">{label}</p>
        <div
          className={cn(
            "mt-0.5 text-xs/relaxed",
            warning ? "text-warning" : "text-foreground",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function ExternalValue({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-primary transition-colors hover:text-primary"
    >
      <span className="break-all">{label}</span>
      <RiExternalLinkLine size={12} aria-hidden className="shrink-0" />
    </a>
  )
}

export function LeadGbpInformationCard({
  profile,
  gaps,
}: {
  profile: LeadGbpProfile
  gaps: GbpGapId[]
}) {
  const [hoursOpen, setHoursOpen] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const snapshot = profile.payload
  const enrichment = profile.enrichment
  const category =
    enrichment?.category ??
    snapshot.primaryTypeDisplayName ??
    snapshot.primaryType
  const missingSecondary = gaps.includes("no_secondary_categories")
  const missingDescription = gaps.includes("missing_description")
  const thinDescription = gaps.includes("thin_description")
  const description = enrichment?.description ?? null
  const descriptionClamped = Boolean(description && description.length > 240)
  const hours = summarizeOpeningHours(snapshot.weekdayDescriptions)
  const phone = snapshot.nationalPhoneNumber
  const phoneLabel = phone ? formatPhone(phone) || phone : null
  const phoneHref = phone ? toTelHref(phone) : null
  const profileSite = snapshot.websiteDomain ?? snapshot.websiteUri
  const profileHref = snapshot.websiteUri
    ? snapshot.websiteUri
    : snapshot.websiteDomain
      ? canonicalWebsiteUrl(snapshot.websiteDomain)
      : null
  const recordHref = profile.matched_website_key
    ? canonicalWebsiteUrl(profile.matched_website_key)
    : null
  const statusLabel = gbpBusinessStatusLabel(snapshot.businessStatus)

  return (
    <LeadGbpCard title="Informações do perfil">
      <div className="divide-y divide-border/70">
        <FieldRow icon={RiBuilding4Line} label="Categoria principal">
          {category ?? "—"}
        </FieldRow>
        <FieldRow
          icon={RiStackLine}
          label="Categorias secundárias"
          warning={missingSecondary}
        >
          {missingSecondary ? (
            <span className="inline-flex items-center gap-1">
              Não configuradas
              <RiAlertLine size={14} aria-hidden />
            </span>
          ) : enrichment && enrichment.additionalCategories.length > 0 ? (
            enrichment.additionalCategories.join(" · ")
          ) : (
            "—"
          )}
        </FieldRow>
        <FieldRow icon={RiPhoneLine} label="Telefone">
          {phoneLabel && phoneHref ? (
            <a href={phoneHref} className="text-primary hover:text-primary">
              {phoneLabel}
            </a>
          ) : (
            (phoneLabel ?? "—")
          )}
        </FieldRow>
        <FieldRow icon={RiGlobalLine} label="Site no perfil">
          {profileSite && profileHref ? (
            <ExternalValue href={profileHref} label={profileSite} />
          ) : (
            "—"
          )}
        </FieldRow>
        <FieldRow icon={RiGlobalLine} label="Site do cadastro">
          {profile.matched_website_key && recordHref ? (
            <ExternalValue
              href={recordHref}
              label={profile.matched_website_key}
            />
          ) : (
            "—"
          )}
        </FieldRow>
        <FieldRow icon={RiTimeLine} label="Horário">
          {hours.summary ? (
            <div>
              <p>{hours.summary}</p>
              {hours.details.length > 0 ? (
                <>
                  <button
                    type="button"
                    aria-expanded={hoursOpen}
                    onClick={() => setHoursOpen((open) => !open)}
                    className="mt-1 cursor-pointer text-xs/relaxed font-medium text-primary"
                  >
                    {hoursOpen ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>
                  {hoursOpen ? (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {hours.details.map((line) => (
                        <li
                          key={line}
                          className="text-xs/relaxed text-muted-foreground"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            "—"
          )}
        </FieldRow>
        <FieldRow
          icon={RiFileTextLine}
          label="Descrição"
          warning={missingDescription || thinDescription}
        >
          {description ? (
            <div>
              <p
                className={cn(
                  "whitespace-pre-wrap",
                  descriptionClamped && !descriptionOpen && "line-clamp-4",
                )}
              >
                {description}
              </p>
              {thinDescription ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs/relaxed text-warning">
                  Descrição curta
                  <RiAlertLine size={14} aria-hidden />
                </p>
              ) : null}
              {descriptionClamped ? (
                <button
                  type="button"
                  onClick={() => setDescriptionOpen((open) => !open)}
                  className="mt-1 cursor-pointer text-xs/relaxed font-medium text-primary"
                >
                  {descriptionOpen ? "Ver menos" : "Ver mais"}
                </button>
              ) : null}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1">
              Não encontrada
              <RiAlertLine size={14} aria-hidden />
            </span>
          )}
        </FieldRow>
        <FieldRow icon={RiCheckboxCircleLine} label="Status">
          {statusLabel ? (
            <span
              className={cn(
                snapshot.businessStatus === "OPERATIONAL" && "text-success",
              )}
            >
              {statusLabel}
            </span>
          ) : (
            "—"
          )}
        </FieldRow>
        {enrichment && enrichment.services && enrichment.services.length > 0 ? (
          <FieldRow icon={RiStackLine} label="Serviços">
            <ul className="flex flex-col gap-0.5">
              {enrichment.services.map((service, index) => (
                <li key={`${service.category ?? ""}:${service.title}:${index}`}>
                  {service.title}
                </li>
              ))}
            </ul>
          </FieldRow>
        ) : null}
      </div>
    </LeadGbpCard>
  )
}
