"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import {
  RiCheckLine,
  RiCloseLine,
  RiEarthLine,
  RiGlobalLine,
  RiGoogleLine,
  RiKey2Line,
  RiServerLine,
  RiToolsLine,
} from "react-icons/ri"
import {
  completeBriefingAccesses,
  deleteBriefingSecret,
  saveBriefingAccesses,
  upsertBriefingSecret,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingChipField } from "@/components/custom/BriefingChipField"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import {
  attachBriefingClientId,
  useBriefingWriterClientId,
  useBriefingWriterFlushRegistration,
  useWrappedBriefingSave,
} from "@/components/custom/BriefingWriter"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  BriefingRadio as Radio,
  BriefingRadioGroup as RadioGroup,
  BriefingTextField as Input,
} from "@/components/custom/BriefingFormControls/BriefingFormControls"
import {
  ACCESS_ANSWER_IDS,
  ACCESSES_MISSING_LABELS,
  getAccessesMissingGroups,
  isAccessesReadyToComplete,
  sanitizeAccessesPayload,
  type AccessAnswerId,
  type AccessOtherToolItem,
  type BriefingAccessesPayload,
  type BriefingSecretFlags,
} from "@/lib/briefing/accesses"
import { otherSecretKind } from "@/lib/briefing/secrets"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingAccessesFormProps } from "./ClientBriefingAccessesForm.types"

function createItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function parseAnswer(value: string): AccessAnswerId | null {
  return (ACCESS_ANSWER_IDS as readonly string[]).includes(value)
    ? (value as AccessAnswerId)
    : null
}

function syncOtherItems(
  previous: AccessOtherToolItem[],
  names: string[],
): AccessOtherToolItem[] {
  const next: AccessOtherToolItem[] = []
  const usedIds = new Set<string>()

  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const existing = previous.find(
      (item) =>
        !usedIds.has(item.id) &&
        item.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (existing) {
      usedIds.add(existing.id)
      next.push({ ...existing, name: trimmed })
      continue
    }
    next.push({ id: createItemId(), name: trimmed, username: "" })
  }

  return next
}

export function ClientBriefingAccessesForm({
  initialPayload,
  initialSecretFlags,
  initialUpdatedAt,
  initialCompletedAt,
  variant = "portal",
  onBack,
  onContinue,
}: ClientBriefingAccessesFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingAccesses)
  const [payload, setPayload] = useState<BriefingAccessesPayload>(() =>
    sanitizeAccessesPayload(initialPayload),
  )
  const [secretFlags, setSecretFlags] =
    useState<BriefingSecretFlags>(initialSecretFlags)
  const [wordpressPassword, setWordpressPassword] = useState("")
  const [hostingPassword, setHostingPassword] = useState("")
  const [domainPassword, setDomainPassword] = useState("")
  const [otherPasswords, setOtherPasswords] = useState<Record<string, string>>(
    {},
  )
  const [isCompleting, startComplete] = useTransition()
  const [isSavingSecret, setIsSavingSecret] = useState(false)

  const {
    saveState,
    savedAt,
    completedAt,
    errorMessage,
    scheduleSave,
    flushPending,
    markComplete,
    setError,
    clearError,
  } = useBriefingAutosave(initialUpdatedAt, initialCompletedAt, persist)

  const patch = useCallback(
    (partial: Partial<BriefingAccessesPayload>) => {
      setPayload((current) => {
        const next = sanitizeAccessesPayload({ ...current, ...partial })
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  const effectiveFlags = useMemo(() => {
    const flags: BriefingSecretFlags = { ...secretFlags }
    if (wordpressPassword.trim()) flags.wordpress = true
    if (hostingPassword.trim()) flags.hosting_domain = true
    if (domainPassword.trim()) flags.domain = true
    for (const [itemId, password] of Object.entries(otherPasswords)) {
      if (password.trim()) flags[otherSecretKind(itemId)] = true
    }
    return flags
  }, [
    domainPassword,
    hostingPassword,
    otherPasswords,
    secretFlags,
    wordpressPassword,
  ])

  const ready = isAccessesReadyToComplete(payload, effectiveFlags)
  const missingLabels = useMemo(
    () =>
      getAccessesMissingGroups(payload, effectiveFlags).map(
        (group) => ACCESSES_MISSING_LABELS[group],
      ),
    [effectiveFlags, payload],
  )
  const completed = Boolean(completedAt)

  async function persistSecret(kind: string, password: string) {
    const trimmed = password.trim()
    if (!trimmed) return true
    setIsSavingSecret(true)
    const result = await upsertBriefingSecret(
      attachBriefingClientId({ kind, password: trimmed }, writerClientId),
    )
    setIsSavingSecret(false)
    if (result.status === "unauthenticated") {
      setError("Sessão expirada. Atualize a página.")
      return false
    }
    if (result.status === "error") {
      setError(result.message)
      return false
    }
    setSecretFlags((current) => ({ ...current, [kind]: true }))
    return true
  }

  async function flushSecrets(): Promise<boolean> {
    if (payload.wordpress.status === "yes" && wordpressPassword.trim()) {
      const ok = await persistSecret("wordpress", wordpressPassword)
      if (!ok) return false
      setWordpressPassword("")
    }
    if (payload.hosting.status === "yes" && hostingPassword.trim()) {
      const ok = await persistSecret("hosting_domain", hostingPassword)
      if (!ok) return false
      setHostingPassword("")
    }
    if (payload.domain.status === "yes" && domainPassword.trim()) {
      const ok = await persistSecret("domain", domainPassword)
      if (!ok) return false
      setDomainPassword("")
    }
    if (payload.otherTools.status === "yes") {
      for (const item of payload.otherTools.items) {
        const draft = otherPasswords[item.id]?.trim() ?? ""
        if (!draft) continue
        const ok = await persistSecret(otherSecretKind(item.id), draft)
        if (!ok) return false
        setOtherPasswords((current) => {
          const next = { ...current }
          delete next[item.id]
          return next
        })
      }
    }
    return true
  }

  const flushForStaff = useCallback(async () => {
    if (!(await flushPending())) return false
    return flushSecrets()
  }, [flushPending, flushSecrets])

  useBriefingWriterFlushRegistration(flushForStaff)

  function handleWordpressStatus(next: string) {
    const status = parseAnswer(next)
    if (status !== "yes") {
      setWordpressPassword("")
      setSecretFlags((current) => {
        const nextFlags = { ...current }
        delete nextFlags.wordpress
        return nextFlags
      })
      void deleteBriefingSecret(
        attachBriefingClientId({ kind: "wordpress" }, writerClientId),
      )
    }
    patch({
      wordpress: {
        ...payload.wordpress,
        status,
        loginUrl: status === "yes" ? payload.wordpress.loginUrl : "",
        username: status === "yes" ? payload.wordpress.username : "",
      },
    })
  }

  function handleHostingStatus(next: string) {
    const status = parseAnswer(next)
    if (status !== "yes") {
      setHostingPassword("")
      setSecretFlags((current) => {
        const nextFlags = { ...current }
        delete nextFlags.hosting_domain
        return nextFlags
      })
      void deleteBriefingSecret(
        attachBriefingClientId({ kind: "hosting_domain" }, writerClientId),
      )
    }
    patch({
      hosting: {
        ...payload.hosting,
        status,
        panelUrl: status === "yes" ? payload.hosting.panelUrl : "",
        username: status === "yes" ? payload.hosting.username : "",
      },
    })
  }

  function handleDomainStatus(next: string) {
    const status = parseAnswer(next)
    if (status !== "yes") {
      setDomainPassword("")
      setSecretFlags((current) => {
        const nextFlags = { ...current }
        delete nextFlags.domain
        return nextFlags
      })
      void deleteBriefingSecret(
        attachBriefingClientId({ kind: "domain" }, writerClientId),
      )
    }
    patch({
      domain: {
        ...payload.domain,
        status,
        panelUrl: status === "yes" ? payload.domain.panelUrl : "",
        username: status === "yes" ? payload.domain.username : "",
      },
    })
  }

  function handleOtherStatus(next: string) {
    const status = parseAnswer(next)
    if (status !== "yes") {
      for (const item of payload.otherTools.items) {
        void deleteBriefingSecret(
          attachBriefingClientId(
            { kind: otherSecretKind(item.id) },
            writerClientId,
          ),
        )
      }
      setOtherPasswords({})
      setSecretFlags((current) => {
        const nextFlags = { ...current }
        for (const key of Object.keys(nextFlags)) {
          if (key.startsWith("other:")) delete nextFlags[key]
        }
        return nextFlags
      })
    }
    patch({
      otherTools: {
        status,
        items: status === "yes" ? payload.otherTools.items : [],
      },
    })
  }

  function handleOtherNames(names: string[]) {
    const previous = payload.otherTools.items
    const items = syncOtherItems(previous, names)
    const removed = previous.filter(
      (item) => !items.some((next) => next.id === item.id),
    )
    for (const item of removed) {
      void deleteBriefingSecret(
        attachBriefingClientId(
          { kind: otherSecretKind(item.id) },
          writerClientId,
        ),
      )
      setSecretFlags((current) => {
        const nextFlags = { ...current }
        delete nextFlags[otherSecretKind(item.id)]
        return nextFlags
      })
      setOtherPasswords((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    }
    patch({
      otherTools: {
        status: payload.otherTools.status,
        items,
      },
    })
  }

  function handleComplete() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const secretsOk = await flushSecrets()
      if (!secretsOk) return
      const result = await completeBriefingAccesses(
        attachBriefingClientId(payload, writerClientId),
      )
      if (result.status === "unauthenticated") {
        setError("Sessão expirada. Atualize a página.")
        return
      }
      if (result.status === "error") {
        setError(result.message)
        return
      }
      markComplete(result.updatedAt, result.completedAt)
      if (result.completedAt) onContinue?.(result.completedAt)
    })
  }

  const otherNames = payload.otherTools.items.map((item) => item.name)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-24">
      <BriefingSectionCard
        index={1}
        icon={<RiGlobalLine size={18} aria-hidden />}
        title="Acesso ao site (WordPress)"
        description="Caso tenha painel WordPress, informe login e senha."
      >
        <RadioGroup
          label="Tem acesso ao WordPress?"
          orientation="horizontal"
          value={payload.wordpress.status ?? ""}
          onValueChange={handleWordpressStatus}
        >
          <Radio value="yes" label="Sim" />
          <Radio value="no" label="Não" />
        </RadioGroup>
        {payload.wordpress.status === "yes" ? (
          <>
            <Input
              id="briefing-wp-login-url"
              label="URL de login"
              value={payload.wordpress.loginUrl}
              onChange={(event) =>
                patch({
                  wordpress: {
                    ...payload.wordpress,
                    loginUrl: event.target.value,
                  },
                })
              }
              placeholder="https://seusite.com/wp-admin"
            />
            <Input
              id="briefing-wp-username"
              label="Usuário"
              value={payload.wordpress.username}
              onChange={(event) =>
                patch({
                  wordpress: {
                    ...payload.wordpress,
                    username: event.target.value,
                  },
                })
              }
              placeholder="Usuário ou e-mail"
              autoComplete="username"
            />
            <Input
              id="briefing-wp-password"
              type="password"
              label="Senha"
              value={wordpressPassword}
              onChange={(event) => {
                setWordpressPassword(event.target.value)
                clearError()
              }}
              onBlur={() => {
                void persistSecret("wordpress", wordpressPassword).then(
                  (ok) => {
                    if (ok && wordpressPassword.trim()) {
                      setWordpressPassword("")
                    }
                  },
                )
              }}
              placeholder={
                secretFlags.wordpress
                  ? "Senha salva — digite para trocar"
                  : "Senha do WordPress"
              }
              autoComplete="new-password"
            />
          </>
        ) : null}
      </BriefingSectionCard>

      <BriefingSectionCard
        index={2}
        icon={<RiGoogleLine size={18} aria-hidden />}
        title="Search Console"
        description="Caso tenha, informe o e-mail para receber o convite."
      >
        <RadioGroup
          label="Tem acesso ao Search Console?"
          orientation="horizontal"
          value={payload.searchConsole.status ?? ""}
          onValueChange={(next) =>
            patch({
              searchConsole: {
                status: parseAnswer(next),
                inviteEmail:
                  parseAnswer(next) === "yes"
                    ? payload.searchConsole.inviteEmail
                    : "",
              },
            })
          }
        >
          <Radio value="yes" label="Sim" />
          <Radio value="no" label="Não" />
        </RadioGroup>
        {payload.searchConsole.status === "yes" ? (
          <Input
            id="briefing-sc-email"
            type="email"
            label="E-mail para o convite"
            value={payload.searchConsole.inviteEmail}
            onChange={(event) =>
              patch({
                searchConsole: {
                  ...payload.searchConsole,
                  inviteEmail: event.target.value,
                },
              })
            }
            placeholder="voce@empresa.com"
          />
        ) : null}
      </BriefingSectionCard>

      <BriefingSectionCard
        index={3}
        icon={<RiGoogleLine size={18} aria-hidden />}
        title="Google Analytics"
        description="Caso tenha, informe o e-mail para receber o convite."
      >
        <RadioGroup
          label="Tem acesso ao Google Analytics?"
          orientation="horizontal"
          value={payload.analytics.status ?? ""}
          onValueChange={(next) =>
            patch({
              analytics: {
                status: parseAnswer(next),
                inviteEmail:
                  parseAnswer(next) === "yes"
                    ? payload.analytics.inviteEmail
                    : "",
              },
            })
          }
        >
          <Radio value="yes" label="Sim" />
          <Radio value="no" label="Não" />
        </RadioGroup>
        {payload.analytics.status === "yes" ? (
          <Input
            id="briefing-ga-email"
            type="email"
            label="E-mail para o convite"
            value={payload.analytics.inviteEmail}
            onChange={(event) =>
              patch({
                analytics: {
                  ...payload.analytics,
                  inviteEmail: event.target.value,
                },
              })
            }
            placeholder="voce@empresa.com"
          />
        ) : null}
      </BriefingSectionCard>

      <BriefingSectionCard
        index={4}
        icon={<RiKey2Line size={18} aria-hidden />}
        title="Google Meu Negócio"
        description="Convite para gerenciamento do perfil."
      >
        <RadioGroup
          label="Tem acesso ao Google Meu Negócio?"
          orientation="horizontal"
          value={payload.gbp.status ?? ""}
          onValueChange={(next) =>
            patch({
              gbp: {
                status: parseAnswer(next),
                inviteEmail:
                  parseAnswer(next) === "yes" ? payload.gbp.inviteEmail : "",
              },
            })
          }
        >
          <Radio value="yes" label="Sim" />
          <Radio value="no" label="Não" />
        </RadioGroup>
        {payload.gbp.status === "yes" ? (
          <Input
            id="briefing-gbp-email"
            type="email"
            label="E-mail para o convite"
            value={payload.gbp.inviteEmail}
            onChange={(event) =>
              patch({
                gbp: {
                  ...payload.gbp,
                  inviteEmail: event.target.value,
                },
              })
            }
            placeholder="voce@empresa.com"
          />
        ) : null}
      </BriefingSectionCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <BriefingSectionCard
          index={5}
          icon={<RiServerLine size={18} aria-hidden />}
          title="Hospedagem"
          description="Painel onde o site está hospedado."
        >
          <RadioGroup
            label="Tem acesso à hospedagem?"
            orientation="horizontal"
            value={payload.hosting.status ?? ""}
            onValueChange={handleHostingStatus}
          >
            <Radio value="yes" label="Sim" />
            <Radio value="no" label="Não" />
          </RadioGroup>
          {payload.hosting.status === "yes" ? (
            <>
              <Input
                id="briefing-hosting-url"
                label="URL do painel"
                value={payload.hosting.panelUrl}
                onChange={(event) =>
                  patch({
                    hosting: {
                      ...payload.hosting,
                      panelUrl: event.target.value,
                    },
                  })
                }
                placeholder="https://painel.provedor.com"
              />
              <Input
                id="briefing-hosting-username"
                label="Usuário"
                value={payload.hosting.username}
                onChange={(event) =>
                  patch({
                    hosting: {
                      ...payload.hosting,
                      username: event.target.value,
                    },
                  })
                }
                placeholder="Usuário do painel"
                autoComplete="username"
              />
              <Input
                id="briefing-hosting-password"
                type="password"
                label="Senha"
                value={hostingPassword}
                onChange={(event) => {
                  setHostingPassword(event.target.value)
                  clearError()
                }}
                onBlur={() => {
                  void persistSecret("hosting_domain", hostingPassword).then(
                    (ok) => {
                      if (ok && hostingPassword.trim()) {
                        setHostingPassword("")
                      }
                    },
                  )
                }}
                placeholder={
                  secretFlags.hosting_domain
                    ? "Senha salva — digite para trocar"
                    : "Senha do painel"
                }
                autoComplete="new-password"
              />
            </>
          ) : null}
        </BriefingSectionCard>

        <BriefingSectionCard
          index={6}
          icon={<RiEarthLine size={18} aria-hidden />}
          title="Domínio"
          description="Painel onde o domínio está registrado (Registro.br, provedor, etc.)."
        >
          <RadioGroup
            label="Tem acesso ao domínio?"
            orientation="horizontal"
            value={payload.domain.status ?? ""}
            onValueChange={handleDomainStatus}
          >
            <Radio value="yes" label="Sim" />
            <Radio value="no" label="Não" />
          </RadioGroup>
          {payload.domain.status === "yes" ? (
            <>
              <Input
                id="briefing-domain-url"
                label="URL do painel"
                value={payload.domain.panelUrl}
                onChange={(event) =>
                  patch({
                    domain: {
                      ...payload.domain,
                      panelUrl: event.target.value,
                    },
                  })
                }
                placeholder="https://registro.br"
              />
              <Input
                id="briefing-domain-username"
                label="Usuário"
                value={payload.domain.username}
                onChange={(event) =>
                  patch({
                    domain: {
                      ...payload.domain,
                      username: event.target.value,
                    },
                  })
                }
                placeholder="Usuário do registro"
                autoComplete="username"
              />
              <Input
                id="briefing-domain-password"
                type="password"
                label="Senha"
                value={domainPassword}
                onChange={(event) => {
                  setDomainPassword(event.target.value)
                  clearError()
                }}
                onBlur={() => {
                  void persistSecret("domain", domainPassword).then((ok) => {
                    if (ok && domainPassword.trim()) {
                      setDomainPassword("")
                    }
                  })
                }}
                placeholder={
                  secretFlags.domain
                    ? "Senha salva — digite para trocar"
                    : "Senha do painel"
                }
                autoComplete="new-password"
              />
            </>
          ) : null}
        </BriefingSectionCard>
      </div>

      <BriefingSectionCard
        index={7}
        icon={<RiToolsLine size={18} aria-hidden />}
        title="Outras ferramentas"
        description="CRM, e-mail marketing, chat ou qualquer outra ferramenta relevante."
      >
        <RadioGroup
          label="Usa outras ferramentas?"
          orientation="horizontal"
          value={payload.otherTools.status ?? ""}
          onValueChange={handleOtherStatus}
        >
          <Radio value="yes" label="Sim" />
          <Radio value="no" label="Não" />
        </RadioGroup>
        {payload.otherTools.status === "yes" ? (
          <>
            <BriefingChipField
              id="briefing-other-tools"
              label="Quais ferramentas?"
              values={otherNames}
              onChange={handleOtherNames}
              placeholder="Digite o nome e pressione Enter"
            />
            {payload.otherTools.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <p className="text-xs/relaxed font-semibold text-foreground">
                  {item.name}
                </p>
                <Input
                  id={`briefing-other-user-${item.id}`}
                  label="Usuário (opcional)"
                  value={item.username}
                  onChange={(event) =>
                    patch({
                      otherTools: {
                        ...payload.otherTools,
                        items: payload.otherTools.items.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, username: event.target.value }
                            : entry,
                        ),
                      },
                    })
                  }
                  placeholder="Usuário, se houver"
                  autoComplete="username"
                />
                <Input
                  id={`briefing-other-pass-${item.id}`}
                  type="password"
                  label="Senha (opcional)"
                  value={otherPasswords[item.id] ?? ""}
                  onChange={(event) => {
                    setOtherPasswords((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                    clearError()
                  }}
                  onBlur={() => {
                    const draft = otherPasswords[item.id] ?? ""
                    void persistSecret(otherSecretKind(item.id), draft).then(
                      (ok) => {
                        if (ok && draft.trim()) {
                          setOtherPasswords((current) => {
                            const next = { ...current }
                            delete next[item.id]
                            return next
                          })
                        }
                      },
                    )
                  }}
                  placeholder={
                    secretFlags[otherSecretKind(item.id)]
                      ? "Senha salva — digite para trocar"
                      : "Senha, se houver"
                  }
                  autoComplete="new-password"
                />
              </div>
            ))}
          </>
        ) : null}
      </BriefingSectionCard>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs/relaxed text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      {completed ? (
        <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-xs/relaxed text-success mb-15">
          Etapa concluída. Você pode continuar editando; as alterações seguem
          sendo salvas.
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-sticky">
        <div className="pointer-events-auto border-t border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
            <div className="min-w-0">
              <p className="inline-flex min-w-0 items-center gap-1.5 text-xs/relaxed text-muted-foreground">
                {saveState === "saving" || isCompleting || isSavingSecret ? (
                  <>
                    <Spinner aria-hidden className="size-3.5" />
                    Salvando…
                  </>
                ) : saveState === "saved" && savedAt ? (
                  <>
                    <RiCheckLine
                      size={14}
                      aria-hidden
                      className="text-success"
                    />
                    Salvo · {formatTimeShort(savedAt)}
                  </>
                ) : saveState === "error" ? (
                  <>
                    <RiCloseLine
                      size={14}
                      aria-hidden
                      className="text-destructive"
                    />
                    Não foi possível salvar
                  </>
                ) : (
                  "Rascunho salvo automaticamente"
                )}
              </p>
              {!ready && missingLabels.length > 0 ? (
                <p className="mt-0.5 truncate text-xs/relaxed text-muted-foreground">
                  Falta: {missingLabels.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onBack ? (
                <Button type="button" variant="ghost" onClick={onBack}>
                  Voltar
                </Button>
              ) : null}
              {variant === "staff" ? null : (
                <Button
                  type="button"
                  disabled={isCompleting || isSavingSecret || !ready}
                  onClick={handleComplete}
                >
                  {isCompleting
                    ? "Salvando..."
                    : completed
                      ? "Etapa concluída"
                      : "Continuar"}
                  {completed ? (
                    <RiCheckLine size={16} aria-hidden data-icon="inline-end" />
                  ) : null}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
