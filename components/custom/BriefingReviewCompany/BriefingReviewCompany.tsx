import {
  BriefingReviewChips,
  BriefingReviewField,
  BriefingReviewSection,
} from "@/components/custom/BriefingReviewField"
import { joinBrazilianAddress } from "@/lib/briefing/address"
import { parseHoursLines, WEEKDAYS } from "@/lib/briefing/hours"
import { DIGITAL_CHANNEL_LABELS } from "@/lib/leads/digital-channels"
import { formatPhone, formatPostalCode } from "@/lib/br-documents"
import type { BriefingReviewCompanyProps } from "./BriefingReviewCompany.types"

export function BriefingReviewCompany({ payload }: BriefingReviewCompanyProps) {
  const hours = parseHoursLines(payload.hoursLines)
  const address =
    payload.formattedAddress.trim() ||
    joinBrazilianAddress({
      street: payload.street,
      number: payload.number,
      complement: payload.complement,
      neighborhood: payload.neighborhood,
      city: payload.city,
      stateCode: payload.stateCode,
      postalCode: payload.postalCode,
    })

  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Identificação">
        <BriefingReviewField label="Empresa" value={payload.companyName} />
        <BriefingReviewField label="Contato" value={payload.contactName} />
        <BriefingReviewField label="CPF/CNPJ" value={payload.taxId} />
      </BriefingReviewSection>
      <BriefingReviewSection title="Endereço">
        <BriefingReviewField label="Endereço" value={address} />
        <BriefingReviewField
          label="CEP"
          value={
            payload.postalCode
              ? formatPostalCode(payload.postalCode)
              : ""
          }
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Contatos">
        <BriefingReviewField
          label="Telefone"
          value={payload.phone ? formatPhone(payload.phone) : ""}
        />
        <BriefingReviewField
          label="WhatsApp"
          value={payload.whatsapp ? formatPhone(payload.whatsapp) : ""}
        />
        <BriefingReviewField label="E-mail" value={payload.email} />
      </BriefingReviewSection>
      <BriefingReviewChips label="Áreas atendidas" items={payload.servedAreas} />
      <BriefingReviewSection title="Horários">
        {hours.map((day) => {
          const label =
            WEEKDAYS.find((item) => item.id === day.weekday)?.label ??
            day.weekday
          return (
            <BriefingReviewField
              key={day.weekday}
              label={label}
              value={
                day.closed ? "Fechado" : `${day.open} – ${day.close}`
              }
            />
          )
        })}
      </BriefingReviewSection>
      <BriefingReviewSection title="Canais digitais">
        {payload.channels.length === 0 ? (
          <BriefingReviewField label="Canais" value="" />
        ) : (
          payload.channels.map((channel, index) => (
            <BriefingReviewField
              key={`${channel.type}-${index}`}
              label={DIGITAL_CHANNEL_LABELS[channel.type] ?? channel.type}
              value={channel.value}
            />
          ))
        )}
      </BriefingReviewSection>
    </div>
  )
}
