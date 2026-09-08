import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"

const colors = SHADCN_PALETTE.dark

export const GOOGLE_MAPS_DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: colors.background }] },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: colors.mutedForeground }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: colors.background }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: colors.card }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.mutedForeground }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: colors.card }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.mutedForeground }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: colors.muted }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.chart[1] }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: colors.border }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: colors.background }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.mutedForeground }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: colors.secondary }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: colors.background }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.foreground }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: colors.card }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.mutedForeground }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: colors.primary }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: colors.chart[0] }],
  },
]
