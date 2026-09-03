import {
  BriefingReviewField,
  BriefingReviewSection,
  formatYesNo,
} from "@/components/custom/BriefingReviewField"
import { BriefingReviewSecretField } from "@/components/custom/BriefingReviewSecretField"
import { otherSecretKind } from "@/lib/briefing/secrets"
import type { BriefingReviewAccessesProps } from "./BriefingReviewAccesses.types"

export function BriefingReviewAccesses({
  clientId,
  payload,
  secretFlags,
}: BriefingReviewAccessesProps) {
  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="WordPress">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.wordpress.status)}
        />
        <BriefingReviewField label="URL de login" value={payload.wordpress.loginUrl} />
        <BriefingReviewField label="Usuário" value={payload.wordpress.username} />
        <BriefingReviewSecretField
          clientId={clientId}
          kind="wordpress"
          label="Senha"
          hasSecret={Boolean(secretFlags.wordpress)}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Search Console">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.searchConsole.status)}
        />
        <BriefingReviewField
          label="E-mail de convite"
          value={payload.searchConsole.inviteEmail}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Analytics">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.analytics.status)}
        />
        <BriefingReviewField
          label="E-mail de convite"
          value={payload.analytics.inviteEmail}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Google Business Profile">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.gbp.status)}
        />
        <BriefingReviewField
          label="E-mail de convite"
          value={payload.gbp.inviteEmail}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Hospedagem e domínio">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.hostingDomain.status)}
        />
        <BriefingReviewField
          label="URL do painel"
          value={payload.hostingDomain.panelUrl}
        />
        <BriefingReviewField
          label="Usuário"
          value={payload.hostingDomain.username}
        />
        <BriefingReviewSecretField
          clientId={clientId}
          kind="hosting_domain"
          label="Senha"
          hasSecret={Boolean(secretFlags.hosting_domain)}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Outras ferramentas">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.otherTools.status)}
        />
        {payload.otherTools.items.length === 0 ? (
          <BriefingReviewField label="Itens" value="" />
        ) : (
          payload.otherTools.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-canvas px-3 py-2">
              <BriefingReviewField label="Nome" value={item.name} />
              <BriefingReviewField label="Usuário" value={item.username} />
              <BriefingReviewSecretField
                clientId={clientId}
                kind={otherSecretKind(item.id)}
                label="Senha"
                hasSecret={Boolean(secretFlags[otherSecretKind(item.id)])}
              />
            </div>
          ))
        )}
      </BriefingReviewSection>
    </div>
  )
}
