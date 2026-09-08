"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import { RiCheckLine, RiLoader4Line, RiShieldUserLine } from "react-icons/ri"
import { updateTeamMemberRoles } from "@/app/actions/team"
import {
  APP_ROLES,
  APP_ROLE_LABELS,
  isAppRole,
  sortAppRoles,
  type AppRole,
} from "@/lib/auth/roles"
import { cn } from "@/lib/cn"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import type {
  TeamMember,
  TeamRoleManagerProps,
} from "./TeamRoleManager.types"

const EASE = [0.23, 1, 0.32, 1] as const
const SAVE_DEBOUNCE_MS = 400
const SAVED_VISIBLE_MS = 1200
const ROW_STAGGER_S = 0.045
const ROW_STAGGER_CAP_S = 0.4

type SaveState = "idle" | "saving" | "saved"

type TeamMemberRoleRowProps = {
  member: TeamMember
  currentUserId: string
  currentUserIsAdmin: boolean
  index: number
  reduced: boolean
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const first = parts[0][0] ?? ""
  const last = parts[parts.length - 1][0] ?? ""
  return `${first}${last}`.toUpperCase()
}

function formatMemberCount(count: number): string {
  return count === 1 ? "1 pessoa" : `${count} pessoas`
}

function sameRoles(left: readonly AppRole[], right: readonly AppRole[]): boolean {
  if (left.length !== right.length) return false
  return left.every((role, index) => role === right[index])
}

function RoleChips({ roles }: { roles: AppRole[] }) {
  if (roles.length === 0) {
    return (
      <span className="font-sans text-caption text-fg-muted">Sem papel</span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.map((role) => (
        <span
          key={role}
          className="inline-flex max-w-[9rem] items-center gap-1 rounded-md border border-border bg-elevated py-0.5 pr-1.5 pl-1.5 font-sans text-caption text-fg"
        >
          {role === "admin" ? (
            <RiShieldUserLine size={12} aria-hidden className="shrink-0" />
          ) : null}
          <span className="truncate">{APP_ROLE_LABELS[role]}</span>
        </span>
      ))}
    </div>
  )
}

function TeamMemberRoleRow({
  member,
  currentUserId,
  currentUserIsAdmin,
  index,
  reduced,
}: TeamMemberRoleRowProps) {
  const [roles, setRoles] = useState<AppRole[]>(member.roles)
  const [message, setMessage] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [isPending, startTransition] = useTransition()
  const committedRoles = useRef<AppRole[]>(member.roles)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const canEdit = currentUserIsAdmin
  const isCurrentUser = member.id === currentUserId
  const isBusy = saveState === "saving" || isPending
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  function persist(nextRoles: AppRole[]) {
    const requestId = ++requestIdRef.current
    const formData = new FormData()
    formData.set("user_id", member.id)
    nextRoles.forEach((role) => formData.append("roles", role))

    startTransition(async () => {
      const result = await updateTeamMemberRoles(formData)
      if (requestId !== requestIdRef.current) return

      if (result.status === "error") {
        setRoles(committedRoles.current)
        setMessage(result.message)
        setSaveState("idle")
        return
      }

      committedRoles.current = result.roles
      setRoles(result.roles)
      setMessage(null)
      setSaveState("saved")
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => {
        setSaveState("idle")
      }, SAVED_VISIBLE_MS)
    })
  }

  function handleRolesChange(value: string | string[]) {
    const values = Array.isArray(value) ? value : [value]
    const nextRoles = sortAppRoles(values.filter(isAppRole))
    setRoles(nextRoles)
    setMessage(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (
      sameRoles(nextRoles, committedRoles.current) &&
      requestIdRef.current === 0
    ) {
      setSaveState("idle")
      return
    }

    setSaveState("saving")
    debounceRef.current = setTimeout(() => {
      persist(nextRoles)
    }, SAVE_DEBOUNCE_MS)
  }

  const status = isBusy ? "saving" : saveState === "saved" ? "saved" : "idle"

  return (
    <m.li
      variants={{
        hidden: reduced
          ? { opacity: 0 }
          : { opacity: 0, transform: "translateY(8px)" },
        show: {
          opacity: 1,
          ...(reduced ? {} : { transform: "translateY(0px)" }),
          transition: {
            duration: reduced ? 0.15 : 0.18,
            ease: EASE,
            delay: reduced ? 0 : Math.min(index * ROW_STAGGER_S, ROW_STAGGER_CAP_S),
          },
        },
      }}
      className={cn(
        "grid gap-3 px-4 py-3",
        "transition-[background-color] duration-150 ease-out",
        "hover:bg-hover",
        "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_1.5rem] sm:items-center",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold tracking-caption text-accent"
        >
          {getInitials(member.name)}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-sans text-body-sm font-semibold text-fg">
              {member.name}
            </p>
            {isCurrentUser ? (
              <span className="shrink-0 rounded-md border border-border-subtle px-1.5 py-0.5 font-sans text-caption text-fg-muted">
                Você
              </span>
            ) : null}
          </div>
          <p className="truncate font-sans text-caption text-fg-muted">
            {member.email}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        {canEdit ? (
          <FieldSet className="flex-row flex-wrap gap-2" aria-label={`Papéis de ${member.name}`}>
            {APP_ROLES.map((role) => {
              const inputId = `team-member-${member.id}-${role}`
              return <Field key={role} orientation="horizontal" className="w-auto"><Checkbox id={inputId} checked={roles.includes(role)} disabled={isBusy} onCheckedChange={(next) => handleRolesChange(next === true ? [...roles, role] : roles.filter((item) => item !== role))} /><FieldLabel htmlFor={inputId}>{role === "admin" ? <><RiShieldUserLine size={14} aria-hidden />{APP_ROLE_LABELS[role]}</> : APP_ROLE_LABELS[role]}</FieldLabel></Field>
            })}
            <FieldError>{message}</FieldError>
          </FieldSet>
        ) : (
          <RoleChips roles={member.roles} />
        )}
      </div>

      <div
        className="flex h-6 w-6 items-center justify-center justify-self-end"
        aria-live="polite"
        role="status"
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "saving" ? (
            <m.span
              key="saving"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0.1 } }
                  : { opacity: 0, scale: 0.95, transition: { duration: 0.12, ease: EASE } }
              }
              transition={{ duration: reduced ? 0.15 : 0.16, ease: EASE }}
              className="inline-flex text-fg-muted"
            >
              <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              <span className="sr-only">Salvando papéis</span>
            </m.span>
          ) : status === "saved" ? (
            <m.span
              key="saved"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0.1 } }
                  : { opacity: 0, scale: 0.95, transition: { duration: 0.12, ease: EASE } }
              }
              transition={{ duration: reduced ? 0.15 : 0.16, ease: EASE }}
              className="inline-flex text-success"
            >
              <RiCheckLine size={16} aria-hidden />
              <span className="sr-only">Papéis atualizados</span>
            </m.span>
          ) : null}
        </AnimatePresence>
      </div>
    </m.li>
  )
}

export function TeamRoleManager({
  members,
  currentUserId,
  currentUserIsAdmin,
}: TeamRoleManagerProps) {
  const reduced = !!useReducedMotion()
  const fadeUp = reduced
    ? {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { duration: 0.15 },
        },
      }
    : {
        hidden: { opacity: 0, transform: "translateY(8px)" },
        show: {
          opacity: 1,
          transform: "translateY(0px)",
          transition: { duration: 0.18, ease: EASE },
        },
      }
  const panelFade = reduced
    ? {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { duration: 0.15 },
        },
      }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            duration: 0.18,
            ease: EASE,
            delayChildren: 0.06,
          },
        },
      }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="px-[var(--page-padding-x)] py-8">
        <m.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: reduced ? 0 : 0.16,
              },
            },
          }}
          className="mx-auto flex max-w-6xl flex-col gap-6"
        >
          <m.header
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: reduced ? 0 : 0.05,
                },
              },
            }}
            className="flex flex-col gap-1"
          >
            <m.p
              variants={fadeUp}
              className="font-sans text-caption font-medium uppercase tracking-widest text-fg-muted"
            >
              Configurações
            </m.p>
            <m.div
              variants={fadeUp}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <h1 className="font-display text-display font-semibold text-fg">
                Equipe
              </h1>
              <p className="font-sans text-caption text-fg-muted">
                {formatMemberCount(members.length)}
              </p>
            </m.div>
            <m.p
              variants={fadeUp}
              className="max-w-3xl font-sans text-body-sm text-fg-secondary"
            >
              Papéis definem o acesso. Só administradores alteram.
            </m.p>
          </m.header>

          {members.length === 0 ? (
            <m.div
              variants={fadeUp}
              className="rounded-xl border border-border bg-surface px-6 py-10 text-center shadow-card"
            >
              <p className="font-sans text-body-sm text-fg-secondary">
                Nenhum usuário encontrado.
              </p>
            </m.div>
          ) : (
            <m.ul
              variants={panelFade}
              className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border bg-surface shadow-card"
            >
              {members.map((member, index) => (
                <TeamMemberRoleRow
                  key={member.id}
                  member={member}
                  currentUserId={currentUserId}
                  currentUserIsAdmin={currentUserIsAdmin}
                  index={index}
                  reduced={reduced}
                />
              ))}
            </m.ul>
          )}
        </m.div>
      </div>
    </LazyMotion>
  )
}
