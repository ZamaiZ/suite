export type BriefingServiceRadiusMapProps = {
  latitude: number | null
  longitude: number | null
  radiusKm: number
  formattedAddress: string
  loading?: boolean
  errorMessage?: string | null
  onRetry?: () => void
  className?: string
}
