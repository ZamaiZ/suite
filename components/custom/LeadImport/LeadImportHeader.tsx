"use client"

import { RiCloseLine, RiUploadCloud2Line } from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/Button"

export function LeadImportHeader({
  onClose,
  closeDisabled,
}: {
  onClose: () => void
  closeDisabled: boolean
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle bg-elevated px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <LeadIconWell icon={RiUploadCloud2Line} />
        <div className="min-w-0">
          <p className="font-display text-title font-semibold text-fg">
            Importar leads
          </p>
          <p className="mt-1 font-sans text-body-sm text-fg-muted">
            Importe uma ou mais planilhas seguindo o modelo do CRM. A validação
            começa no envio. Importar só libera com zero problemas e zero conflitos.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
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
