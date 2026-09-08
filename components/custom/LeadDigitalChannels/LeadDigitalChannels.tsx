"use client"

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMore2Line,
  RiStarFill,
  RiStarLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DIGITAL_CHANNEL_DUPLICATE_MESSAGE,
  DIGITAL_CHANNEL_INVALID_MESSAGE,
  DIGITAL_CHANNEL_LABELS,
  DIGITAL_CHANNEL_PLACEHOLDERS,
  DIGITAL_CHANNEL_TYPES,
  DIGITAL_CHANNELS_MAX,
  digitalChannelConflictKey,
  digitalChannelDisplay,
  hrefForDigitalChannel,
  isDigitalChannelType,
  normalizeDigitalChannel,
  setPrimaryDigitalChannel,
  withEnsuredPrimaries,
  type DigitalChannelDraft,
  type DigitalChannelType,
} from "@/lib/leads/digital-channels"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import type {
  LeadDigitalChannelListProps,
  LeadDigitalChannelsHandle,
  LeadDigitalChannelsProps,
} from "./LeadDigitalChannels.types"

const EASE = [0.23, 1, 0.32, 1] as const

type DraftState = {
  type: DigitalChannelType
  value: string
  is_primary: boolean
}

function ChannelGlyph({
  type,
  size = 16,
}: {
  type: DigitalChannelType
  size?: number
}) {
  const Icon = CHANNEL_ICONS[type]
  return <Icon size={size} aria-hidden />
}

function websiteCount(channels: DigitalChannelDraft[]) {
  return channels.filter((channel) => channel.type === "website").length
}

function commitDraftToList(
  channels: DigitalChannelDraft[],
  draft: DraftState,
): { next: DigitalChannelDraft[] } | { error: string } {
  const normalized = normalizeDigitalChannel(draft.type, draft.value)
  if (!normalized) {
    return { error: DIGITAL_CHANNEL_INVALID_MESSAGE[draft.type] }
  }
  const key = digitalChannelConflictKey(draft.type, normalized.normalized_key)
  const duplicate = channels.some((channel) => {
    const other = normalizeDigitalChannel(channel.type, channel.value)
    if (!other) return false
    return digitalChannelConflictKey(channel.type, other.normalized_key) === key
  })
  if (duplicate) {
    return { error: DIGITAL_CHANNEL_DUPLICATE_MESSAGE[draft.type] }
  }
  if (draft.type !== "website" && websiteCount(channels) === 0) {
    return { error: "Site obrigatório." }
  }
  const isPrimary =
    draft.is_primary || !channels.some((channel) => channel.type === draft.type)
  return {
    next: withEnsuredPrimaries([
      ...channels,
      {
        type: draft.type,
        value: normalized.value,
        is_primary: isPrimary,
      },
    ]),
  }
}

export function LeadDigitalChannels({
  id,
  value,
  onValueChange,
  error,
  disabled,
  onBlur,
  onDraftChange,
  ref,
}: LeadDigitalChannelsProps & { ref?: Ref<LeadDigitalChannelsHandle> }) {
  const allowFocusRef = useRef(false)
  const [draft, setDraft] = useState<DraftState | null>(() =>
    value.length === 0
      ? { type: "website", value: "", is_primary: true }
      : null,
  )
  const [draftError, setDraftError] = useState<string | null>(null)
  const reduced = !!useReducedMotion()

  function openDraft(next: DraftState) {
    allowFocusRef.current = true
    setDraft(next)
    setDraftError(null)
  }

  useEffect(() => {
    if (!draft || !allowFocusRef.current) return
    allowFocusRef.current = false
    document.getElementById(`${id}-value`)?.focus()
  }, [draft, id])

  useEffect(() => {
    onDraftChange?.(Boolean(draft?.value.trim()))
    return () => onDraftChange?.(false)
  }, [draft, onDraftChange])

  function commitDraft(): DigitalChannelDraft[] | null {
    if (!draft) return value
    if (!draft.value.trim()) {
      if (websiteCount(value) === 0) {
        setDraftError("Site obrigatório.")
        return null
      }
      setDraft(null)
      setDraftError(null)
      return value
    }
    const result = commitDraftToList(value, draft)
    if ("error" in result) {
      setDraftError(result.error)
      return null
    }
    onValueChange(result.next)
    setDraft(null)
    setDraftError(null)
    return result.next
  }

  useImperativeHandle(ref, () => ({
    flush: () => commitDraft() !== null,
  }))

  function addChannel() {
    if (disabled) return
    const committed = draft ? commitDraft() : value
    if (committed === null) return
    if (committed.length >= DIGITAL_CHANNELS_MAX) return
    openDraft({
      type: "website",
      value: "",
      is_primary: !committed.some((channel) => channel.type === "website"),
    })
  }

  function startEdit(index: number) {
    if (disabled) return
    let current = value
    if (draft?.value.trim()) {
      const result = commitDraftToList(value, draft)
      if ("error" in result) {
        setDraftError(result.error)
        return
      }
      current = result.next
    }
    const item = current[index]
    if (!item) return
    onValueChange(withEnsuredPrimaries(current.filter((_, i) => i !== index)))
    openDraft({
      type: item.type,
      value: item.value,
      is_primary: item.is_primary,
    })
  }

  function removeAt(index: number) {
    if (disabled) return
    const item = value[index]
    if (!item) return
    if (item.type === "website" && websiteCount(value) <= 1) return
    onValueChange(withEnsuredPrimaries(value.filter((_, i) => i !== index)))
  }

  function markPrimary(index: number) {
    if (disabled) return
    onValueChange(setPrimaryDigitalChannel(value, index))
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    const committed = commitDraft()
    if (committed && committed.length < DIGITAL_CHANNELS_MAX) {
      openDraft({
        type: draft?.type ?? "website",
        value: "",
        is_primary: !committed.some(
          (channel) => channel.type === (draft?.type ?? "website"),
        ),
      })
    }
  }

  function onValueBlur() {
    onBlur?.()
  }

  const atLimit = value.length >= DIGITAL_CHANNELS_MAX && !draft
  const listError = error && !draftError ? error : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {value.map((channel, index) => (
          <ChannelItem
            key={`${channel.type}-${channel.value}-${index}`}
            channel={channel}
            disabled={disabled}
            reduced={reduced}
            canRemove={channel.type !== "website" || websiteCount(value) > 1}
            onOpen={() => startEdit(index)}
            onPrimary={() => markPrimary(index)}
            onRemove={() => removeAt(index)}
          />
        ))}
      </div>

      {draft ? (
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start">
          <Select
            value={draft.type}
            disabled={disabled}
            onValueChange={(next) => {
              const type = String(next)
              if (!isDigitalChannelType(type)) return
              setDraft({
                ...draft,
                type,
                is_primary:
                  draft.is_primary ||
                  !value.some((channel) => channel.type === type),
              })
              setDraftError(null)
            }}
          >
            <SelectTrigger id={`${id}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {DIGITAL_CHANNEL_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  <ChannelGlyph type={type} />
                  {DIGITAL_CHANNEL_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Field data-invalid={Boolean(draftError)}>
            <InputGroup>
              <InputGroupAddon>
                <ChannelGlyph type={draft.type} />
              </InputGroupAddon>
              <InputGroupInput
                id={`${id}-value`}
                value={draft.value}
                placeholder={DIGITAL_CHANNEL_PLACEHOLDERS[draft.type]}
                aria-invalid={Boolean(draftError)}
                disabled={disabled}
                autoComplete="url"
                onChange={(event) => {
                  setDraft({ ...draft, value: event.target.value })
                  if (draftError) setDraftError(null)
                }}
                onBlur={onValueBlur}
                onKeyDown={onDraftKeyDown}
              />
            </InputGroup>
            <FieldError>{draftError}</FieldError>
          </Field>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={disabled || atLimit}
        onClick={addChannel}
        className="w-full border-dashed"
      >
        <RiAddLine size={16} aria-hidden />
        Adicionar canal
      </Button>

      {listError ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {listError}
        </p>
      ) : null}
    </div>
  )
}

function ChannelItem({
  channel,
  disabled,
  reduced,
  canRemove,
  onOpen,
  onPrimary,
  onRemove,
}: {
  channel: DigitalChannelDraft
  disabled?: boolean
  reduced: boolean
  canRemove: boolean
  onOpen: () => void
  onPrimary: () => void
  onRemove: () => void
}) {
  const Icon = CHANNEL_ICONS[channel.type]
  const display = digitalChannelDisplay(channel.type, channel.value)

  return (
    <m.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.16, ease: EASE }}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-popover px-3 py-2.5"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left disabled:cursor-default"
      >
        <LeadIconWell icon={Icon} />
        <span className="min-w-0">
          <span className="block text-xs/relaxed text-muted-foreground">
            {DIGITAL_CHANNEL_LABELS[channel.type]}
          </span>
          <span className="block truncate text-xs/relaxed font-medium text-foreground">
            {display}
          </span>
        </span>
      </button>
      {channel.is_primary ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs/relaxed font-medium text-primary">
          <RiStarFill size={12} aria-hidden />
          Principal
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" />}
          disabled={disabled}
          aria-label={`Ações de ${DIGITAL_CHANNEL_LABELS[channel.type]}`}
        >
          <RiMore2Line size={16} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem disabled={channel.is_primary} onClick={onPrimary}>
            <RiStarLine size={16} aria-hidden />
            Definir como principal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpen}>
            <RiEditLine size={16} aria-hidden />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canRemove}
            onClick={onRemove}
            variant="destructive"
          >
            <RiDeleteBinLine size={16} aria-hidden />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </m.div>
  )
}

export function LeadDigitalChannelList({
  channels,
}: LeadDigitalChannelListProps) {
  if (channels.length === 0) {
    return (
      <p className="text-xs/relaxed text-muted-foreground">Nenhum canal.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {channels.map((channel, index) => {
        const Icon = CHANNEL_ICONS[channel.type]
        const display = digitalChannelDisplay(channel.type, channel.value)
        const href = hrefForDigitalChannel(channel.type, channel.value)
        return (
          <div
            key={`${channel.type}-${channel.value}-${index}`}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-popover px-3 py-2.5"
          >
            <LeadIconWell icon={Icon} />
            <div className="min-w-0 flex-1">
              <p className="text-xs/relaxed text-muted-foreground">
                {DIGITAL_CHANNEL_LABELS[channel.type]}
              </p>
              <p className="truncate text-xs/relaxed font-medium text-foreground">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {display}
                  </a>
                ) : (
                  display
                )}
              </p>
            </div>
            {channel.is_primary ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs/relaxed font-medium text-primary">
                <RiStarFill size={12} aria-hidden />
                Principal
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
