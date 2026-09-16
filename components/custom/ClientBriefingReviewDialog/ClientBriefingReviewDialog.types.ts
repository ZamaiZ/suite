import type { ClientPortalSnapshot } from "@/components/custom/ClientCardMenu"

export type ClientBriefingReviewDialogProps = {
  open: boolean
  onClose: () => void
  clientId: string | null
  companyName?: string
  /**
   * Estado do portal que a listagem já tem. Vai ao menu do cabeçalho para ele
   * abrir pronto, sem repetir a consulta que a lista já fez.
   */
  portalSnapshot?: ClientPortalSnapshot
  readOnly?: boolean
}
