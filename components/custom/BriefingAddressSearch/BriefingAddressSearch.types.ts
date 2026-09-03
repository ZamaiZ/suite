import type { PlaceSuggestion } from "@/lib/places"

export type BriefingAddressSearchProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  onPick: (item: PlaceSuggestion, sessionToken: string) => void
  disabled?: boolean
  error?: string
}
