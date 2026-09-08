"use client"

import { RiCloseLine, RiUserAddLine } from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/button"

export function LeadCreateHeader({
  onClose,
  closeDisabled,
}: {
  onClose: () => void
  closeDisabled: boolean
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle bg-elevated px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiUserAddLine} />
        <div className="min-w-0">
          <p className="font-display text-title font-semibold text-fg">
            Novo lead
          </p>
          <p className="mt-1 font-sans text-body-sm text-fg-muted">
            Cadastre uma empresa e seu principal contato.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Fechar"
        onClick={onClose}
        disabled={closeDisabled}
        className="size-9 shrink-0 px-0"
      >
        <RiCloseLine size={18} aria-hidden />
      </Button>
    </div>
  )
}
