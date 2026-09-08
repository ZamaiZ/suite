import { z } from "zod"
import { digitsOnly, isValidCnpj, isValidCpf } from "@/lib/br-documents"
import { isBrazilStateCode } from "@/lib/br-locations"
import { isDigitalChannelType } from "@/lib/leads/digital-channels"
import type { BriefingCompanyPayload } from "@/lib/briefing/company"

const optionalLine = z.string().trim().max(240)

const channelSchema = z.object({
  type: z.string().refine(isDigitalChannelType, "Canal inválido."),
  value: z.string().trim().max(500),
})

export const briefingCompanyPayloadSchema = z
  .object({
    companyName: optionalLine,
    contactName: optionalLine,
    taxId: z.string().trim().max(18),
    postalCode: z.string().trim().max(9),
    street: z.string().trim().max(200),
    number: z.string().trim().max(20),
    complement: z.string().trim().max(80),
    neighborhood: z.string().trim().max(80),
    city: z.string().trim().max(80),
    stateCode: z.string().trim().max(2),
    formattedAddress: z.string().trim().max(300),
    servedAreas: z.array(z.string().trim().max(80)).max(40),
    phone: z.string().trim().max(20),
    whatsapp: z.string().trim().max(20),
    email: z.string().trim().max(254),
    hoursLines: z.array(z.string().trim().max(120)).max(14),
    channels: z.array(channelSchema).max(10),
  })
  .superRefine((data, ctx) => {
    const taxDigits = digitsOnly(data.taxId)
    if (
      taxDigits.length > 0 &&
      !isValidCpf(taxDigits) &&
      !isValidCnpj(taxDigits)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["taxId"],
        message: "Informe um CPF ou CNPJ válido, ou deixe em branco.",
      })
    }

    if (data.stateCode.length > 0 && !isBrazilStateCode(data.stateCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "UF inválida.",
      })
    }

    if (data.email.length > 0 && !z.email().safeParse(data.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "E-mail inválido.",
      })
    }

    const postal = digitsOnly(data.postalCode)
    if (postal.length > 0 && postal.length !== 8) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "CEP inválido.",
      })
    }
  })

export type BriefingCompanyInput = z.infer<typeof briefingCompanyPayloadSchema>

export function toCompanyPayload(
  data: BriefingCompanyInput,
): BriefingCompanyPayload {
  return {
    companyName: data.companyName,
    contactName: data.contactName,
    taxId: digitsOnly(data.taxId),
    postalCode: digitsOnly(data.postalCode),
    street: data.street,
    number: data.number,
    complement: data.complement,
    neighborhood: data.neighborhood,
    city: data.city,
    stateCode: data.stateCode.toUpperCase(),
    formattedAddress: data.formattedAddress,
    servedAreas: data.servedAreas
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    phone: data.phone,
    whatsapp: data.whatsapp,
    email: data.email,
    hoursLines: data.hoursLines.filter((line) => line.length > 0),
    channels: data.channels
      .filter((channel) => channel.value.length > 0)
      .map((channel) => ({
        type: channel.type,
        value: channel.value,
      })),
  }
}
