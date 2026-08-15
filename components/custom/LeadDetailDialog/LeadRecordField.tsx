import type { IconType } from "react-icons"
import { LeadIconWell } from "./LeadIconWell"

export function hrefForWebsite(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`
  return null
}

export function LeadRecordField({
  icon,
  label,
  value,
  href,
}: {
  icon: IconType
  label: string
  value: string | null | undefined
  href?: string | null
}) {
  const display = value?.trim() ? value.trim() : "—"
  const link = href?.trim() ? href.trim() : null
  const external =
    link !== null &&
    !link.startsWith("mailto:") &&
    !link.startsWith("tel:")

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <LeadIconWell icon={icon} />
      <div className="min-w-0">
        <p className="font-sans text-caption text-fg-muted">{label}</p>
        <p className="truncate font-sans text-body-sm font-medium text-fg">
          {link && value?.trim() ? (
            <a
              href={link}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className="text-accent underline-offset-2 hover:underline"
            >
              {display}
            </a>
          ) : (
            display
          )}
        </p>
      </div>
    </div>
  )
}
