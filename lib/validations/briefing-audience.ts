import { z } from "zod"
import {
  AUDIENCE_CHIP_ITEM_MAX,
  AUDIENCE_CHIP_MAX,
  AUDIENCE_LINE_MAX,
  AUDIENCE_TEXTAREA_MAX,
  PERSONA_AGE_RANGE_IDS,
  PERSONA_INCOME_RANGE_IDS,
  PERSONA_SEX_IDS,
  SERVICE_RADIUS_KM_MAX,
  SERVICE_RADIUS_KM_MIN,
  type BriefingAudiencePayload,
  type PersonaAgeRangeId,
  type PersonaIncomeRangeId,
  type PersonaSexId,
} from "@/lib/briefing/audience"

const audienceText = z.string().trim().max(AUDIENCE_TEXTAREA_MAX)
const audienceLine = z.string().trim().max(AUDIENCE_LINE_MAX)
const chipItem = z.string().trim().max(AUDIENCE_CHIP_ITEM_MAX)

export const briefingAudiencePayloadSchema = z.object({
  personaAgeRanges: z
    .array(z.enum(PERSONA_AGE_RANGE_IDS))
    .max(PERSONA_AGE_RANGE_IDS.length),
  personaSex: z.union([z.enum(PERSONA_SEX_IDS), z.null()]),
  personaCity: audienceLine,
  personaProfession: audienceLine,
  personaIncomeRanges: z
    .array(z.enum(PERSONA_INCOME_RANGE_IDS))
    .max(PERSONA_INCOME_RANGE_IDS.length),
  personaPains: z.array(chipItem).max(AUDIENCE_CHIP_MAX),
  personaBehaviors: z.array(chipItem).max(AUDIENCE_CHIP_MAX),
  personaObjections: audienceText,
  personaTraits: audienceText,
  voiceTone: audienceText,
  serviceRadiusNotApplicable: z.boolean(),
  serviceRadiusKm: z
    .number()
    .int()
    .min(SERVICE_RADIUS_KM_MIN)
    .max(SERVICE_RADIUS_KM_MAX),
  mapLatitude: z.union([z.number().finite(), z.null()]),
  mapLongitude: z.union([z.number().finite(), z.null()]),
  mapAddressKey: z.string().trim().max(500),
  targetNeighborhoods: z.array(chipItem).max(AUDIENCE_CHIP_MAX),
  targetCities: z.array(chipItem).max(AUDIENCE_CHIP_MAX),
  priorityRegion: audienceLine,
  keywords: z.array(chipItem).max(AUDIENCE_CHIP_MAX),
  primaryKeyword: chipItem,
})

export type BriefingAudienceInput = z.infer<typeof briefingAudiencePayloadSchema>

function normalizeChips(values: string[]): string[] {
  return values
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function toAudiencePayload(
  data: BriefingAudienceInput,
): BriefingAudiencePayload {
  const keywords = normalizeChips(data.keywords)
  const primaryKeyword = data.primaryKeyword.trim()

  return {
    personaAgeRanges: data.personaAgeRanges.filter(
      (id, index, list) => list.findIndex((item) => item === id) === index,
    ) as PersonaAgeRangeId[],
    personaSex: data.personaSex as PersonaSexId | null,
    personaCity: data.personaCity,
    personaProfession: data.personaProfession,
    personaIncomeRanges: data.personaIncomeRanges.filter(
      (id, index, list) => list.findIndex((item) => item === id) === index,
    ) as PersonaIncomeRangeId[],
    personaPains: normalizeChips(data.personaPains),
    personaBehaviors: normalizeChips(data.personaBehaviors),
    personaObjections: data.personaObjections,
    personaTraits: data.personaTraits,
    voiceTone: data.voiceTone,
    serviceRadiusNotApplicable: data.serviceRadiusNotApplicable === true,
    serviceRadiusKm: data.serviceRadiusKm,
    mapLatitude: data.mapLatitude,
    mapLongitude: data.mapLongitude,
    mapAddressKey: data.mapAddressKey,
    targetNeighborhoods: normalizeChips(data.targetNeighborhoods),
    targetCities: normalizeChips(data.targetCities),
    priorityRegion: data.priorityRegion,
    keywords,
    primaryKeyword,
  }
}
