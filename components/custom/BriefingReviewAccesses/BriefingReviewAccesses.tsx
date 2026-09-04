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
  canRevealSecrets = true,
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
          canReveal={canRevealSecrets}
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
      <BriefingReviewSection title="Hospedagem">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.hosting.status)}
        />
        <BriefingReviewField
          label="URL do painel"
          value={payload.hosting.panelUrl}
        />
        <BriefingReviewField
          label="Usuário"
          value={payload.hosting.username}
        />
        <BriefingReviewSecretField
          clientId={clientId}
          kind="hosting_domain"
          label="Senha"
          hasSecret={Boolean(secretFlags.hosting_domain)}
          canReveal={canRevealSecrets}
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Domínio">
        <BriefingReviewField
          label="Possui?"
          value={formatYesNo(payload.domain.status)}
        />
        <BriefingReviewField
          label="URL do painel"
          value={payload.domain.panelUrl}
        />
        <BriefingReviewField
          label="Usuário"
          value={payload.domain.username}
        />
        <BriefingReviewSecretField
          clientId={clientId}
          kind="domain"
          label="Senha"
          hasSecret={Boolean(secretFlags.domain)}
          canReveal={canRevealSecrets}
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
                canReveal={canRevealSecrets}
              />
            </div>
          ))
        )}
      </BriefingReviewSection>
    </div>
  )
}
