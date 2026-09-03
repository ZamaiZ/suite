export type ClientBriefingReviewDialogProps = {
  open: boolean
  onClose: () => void
  clientId: string | null
  companyName?: string
}
