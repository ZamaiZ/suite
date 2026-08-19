"use client"

import { RiCloseLine } from "react-icons/ri"
import type { IconType } from "react-icons"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/Button"

export function LeadDropHeader({
  icon,
  wellClassName,
  title,
  companyName,
  websiteDomain,
  onClose,
}: {
  icon: IconType
  wellClassName: string
  title: string
  companyName: string
  websiteDomain: string
  onClose: () => void
}) {
  const subtitle = websiteDomain
    ? `${companyName} · ${websiteDomain}`
    : companyName

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle bg-elevated px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={icon} className={wellClassName} />
        <div className="min-w-0">
          <p className="font-display text-title font-semibold text-fg">
            {title}
          </p>
          <p className="mt-1 truncate font-sans text-body-sm text-fg-muted">
            {subtitle}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        aria-label="Fechar"
        onClick={onClose}
        className="size-9 shrink-0 px-0"
      >
        <RiCloseLine size={18} aria-hidden />
      </Button>
    </div>
  )
}
