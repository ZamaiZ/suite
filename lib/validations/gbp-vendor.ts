import { z } from "zod"
import { GBP_DATA_PROVIDERS } from "@/lib/gbp-vendor"

export const updateGbpDataProviderSchema = z.object({
  provider: z.enum(GBP_DATA_PROVIDERS),
})

export type UpdateGbpDataProviderInput = z.infer<
  typeof updateGbpDataProviderSchema
>
