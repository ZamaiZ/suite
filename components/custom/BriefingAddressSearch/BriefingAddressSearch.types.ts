import type { BriefingAddressCandidate } from "@/lib/locationiq"

export type BriefingAddressSearchProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  onPick: (candidate: BriefingAddressCandidate) => void
  disabled?: boolean
  error?: string
}
