"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import {
  Controller,
  useForm,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  RiAddLine,
  RiBuilding4Line,
  RiChat3Line,
  RiFileTextLine,
  RiMailLine,
  RiPhoneLine,
  RiStore2Line,
  RiUserLine,
} from "react-icons/ri"
import { updateLead } from "@/app/actions/leads"
import {
  LeadDigitalChannelList,
  LeadDigitalChannels,
  type LeadDigitalChannelsHandle,
} from "@/components/custom/LeadDigitalChannels"
import { LeadLocationField } from "@/components/custom/LeadLocationField"
import { LeadSegmentField } from "@/components/custom/LeadSegmentField"
import { LeadTagChips, LeadTagField } from "@/components/custom/LeadTagField"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { formatPhone, toTelHref } from "@/lib/br-documents"
import { cn } from "cn"
import {
  toDigitalChannelDrafts,
  type DigitalChannelDraft,
} from "@/lib/leads/digital-channels"
import type { LeadDetail } from "@/app/actions/leads"
import type { LeadTag } from "@/lib/leads/tags"
import type { LeadRecord, LeadWritePayload } from "@/lib/leads/types"
import {
  LEAD_OBSERVATIONS_MAX,
  leadCompanyFormSchema,
  leadContactFormSchema,
  type LeadFieldName,
} from "@/lib/validations/lead"
import { LeadRecordField } from "./LeadRecordField"
import { LeadRecordRail, type LeadRecordSection } from "./LeadRecordRail"
import { LeadRecordSectionCard } from "./LeadRecordSectionCard"

const companySchema = leadCompanyFormSchema

const contactSchema = leadContactFormSchema

const notesSchema = z.object({
  observations: z
    .string()
    .max(
      LEAD_OBSERVATIONS_MAX,
      "Observação deve ter no máximo 2000 caracteres.",
    ),
})

type CompanyValues = z.infer<typeof companySchema>
type ContactValues = z.infer<typeof contactSchema>
type NotesValues = z.infer<typeof notesSchema>
type EditSection = "company" | "contact" | "notes"

function applyNamedErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldErrors?: Partial<Record<LeadFieldName, string[]>>,
) {
  if (!fieldErrors) return
  const values = form.getValues()
  for (const key of Object.keys(fieldErrors) as LeadFieldName[]) {
    if (!(key in values)) continue
    const message = fieldErrors[key]?.[0]
    if (message) form.setError(key as Path<T>, { message })
  }
}

function fillLeadFormData(
  formData: FormData,
  lead: LeadRecord,
  tags: string[],
  overlay: {
    company_name?: string
    channels?: DigitalChannelDraft[]
    segment?: string
    state_code?: string
    city?: string
    contact_name?: string
    phone?: string
    email?: string
    observations?: string
  },
) {
  formData.set("lead_id", lead.id)
  formData.set("company_name", overlay.company_name ?? lead.company_name)
  formData.set("segment", overlay.segment ?? lead.segment?.name ?? "")
  formData.set("state_code", overlay.state_code ?? lead.state_code ?? "")
  formData.set("city", overlay.city ?? lead.city ?? "")
  formData.set(
    "channels",
    JSON.stringify(
      overlay.channels ?? toDigitalChannelDrafts(lead.channels ?? []),
    ),
  )
  formData.set("contact_name", overlay.contact_name ?? lead.contact_name ?? "")
  formData.set("phone", overlay.phone ?? lead.phone ?? "")
  formData.set("email", overlay.email ?? lead.email ?? "")
  formData.set("observations", overlay.observations ?? lead.observations ?? "")
  for (const tag of tags) formData.append("tags", tag)
}

export function LeadRecordPanel({
  detail,
  loading,
  editing,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
  onPendingChange,
}: {
  detail: LeadDetail | null
  loading: boolean
  editing: boolean
  readOnly: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: (fields: LeadWritePayload, tags: LeadTag[]) => void
  onPendingChange: (pending: boolean) => void
}) {
  const [section, setSection] = useState<LeadRecordSection>("all")
  const [sectionEditing, setSectionEditing] = useState<EditSection | null>(null)

  useEffect(() => {
    if (!editing) setSectionEditing(null)
  }, [editing])

  if (loading && !detail) {
    return <RecordSkeleton />
  }

  if (!detail) return null

  function startEdit(next: EditSection) {
    setSectionEditing(next)
    onEdit()
  }

  const showCompany =
    section === "all" || section === "company" || sectionEditing === "company"
  const showContact =
    section === "all" || section === "contact" || sectionEditing === "contact"
  const showNotes =
    section === "all" || section === "notes" || sectionEditing === "notes"

  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-border/70 bg-popover lg:border-r lg:border-b-0">
        <LeadRecordRail
          section={section}
          createdAt={detail.lead.created_at}
          onSectionChange={setSection}
        />
      </aside>
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5">
        {showCompany ? (
          <CompanyCard
            detail={detail}
            editing={sectionEditing === "company"}
            readOnly={readOnly}
            showActions={
              sectionEditing === null || sectionEditing === "company"
            }
            onEdit={() => startEdit("company")}
            onCancel={onCancel}
            onSaved={onSaved}
            onPendingChange={onPendingChange}
          />
        ) : null}
        {showContact ? (
          <ContactCard
            detail={detail}
            editing={sectionEditing === "contact"}
            readOnly={readOnly}
            showActions={
              sectionEditing === null || sectionEditing === "contact"
            }
            onEdit={() => startEdit("contact")}
            onCancel={onCancel}
            onSaved={onSaved}
            onPendingChange={onPendingChange}
          />
        ) : null}
        {showNotes ? (
          <NotesCard
            detail={detail}
            editing={sectionEditing === "notes"}
            readOnly={readOnly}
            showActions={sectionEditing === null || sectionEditing === "notes"}
            onEdit={() => startEdit("notes")}
            onCancel={onCancel}
            onSaved={onSaved}
            onPendingChange={onPendingChange}
          />
        ) : null}
      </div>
    </div>
  )
}

function CompanyCard({
  detail,
  editing,
  readOnly,
  showActions,
  onEdit,
  onCancel,
  onSaved,
  onPendingChange,
}: {
  detail: LeadDetail
  editing: boolean
  readOnly: boolean
  showActions: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: (fields: LeadWritePayload, tags: LeadTag[]) => void
  onPendingChange: (pending: boolean) => void
}) {
  const lead = detail.lead
  const [isPending, startTransition] = useTransition()
  const channelsRef = useRef<LeadDigitalChannelsHandle>(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const [serverMessage, setServerMessage] = useState<{
    text: string
    existingLeadId?: string
  } | null>(null)

  const form = useForm<CompanyValues>({
    resolver: zodResolver(companySchema) as Resolver<CompanyValues>,
    defaultValues: companyDefaults(detail),
  })

  useEffect(() => {
    onPendingChange(isPending)
    return () => onPendingChange(false)
  }, [isPending, onPendingChange])

  useEffect(() => {
    if (!editing) return
    form.reset(companyDefaults(detail))
    setServerMessage(null)
  }, [editing])

  function onSubmit(values: CompanyValues) {
    setServerMessage(null)
    const formData = new FormData()
    fillLeadFormData(formData, lead, values.tags, {
      company_name: values.company_name,
      channels: values.channels,
      segment: values.segment,
      state_code: values.state_code,
      city: values.city,
    })

    startTransition(async () => {
      const result = await updateLead(formData)
      if (result.status === "error") {
        applyNamedErrors(form, result.fieldErrors)
        setServerMessage({
          text: result.message ?? "Revise os dados do lead.",
          existingLeadId: result.existingLeadId,
        })
        return
      }
      onSaved(result.fields, result.tags)
    })
  }

  return (
    <form
      onSubmit={(event) => {
        if (channelsRef.current && !channelsRef.current.flush()) {
          event.preventDefault()
          return
        }
        void form.handleSubmit(onSubmit)(event)
      }}
      noValidate
    >
      <LeadRecordSectionCard
        icon={RiBuilding4Line}
        title="Empresa"
        editing={editing}
        editLabel="Editar empresa"
        readOnly={readOnly}
        pending={isPending}
        saveDisabled={!form.formState.isDirty && !draftDirty}
        showActions={showActions}
        onEdit={onEdit}
        onCancel={onCancel}
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
              <Controller
                name="company_name"
                control={form.control}
                render={({ field, fieldState }) => {
                  const errorId = "lead-record-company-name-error"
                  return (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel htmlFor="lead-record-company-name">
                        Nome da empresa
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <RiBuilding4Line aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="lead-record-company-name"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isPending}
                          autoComplete="organization"
                          aria-invalid={!!fieldState.error}
                          aria-describedby={
                            fieldState.error ? errorId : undefined
                          }
                        />
                      </InputGroup>
                      <FieldError id={errorId}>
                        {fieldState.error?.message}
                      </FieldError>
                    </Field>
                  )
                }}
              />
              <Controller
                name="channels"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LeadDigitalChannels
                    ref={channelsRef}
                    id="lead-record-channels"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    onDraftChange={setDraftDirty}
                    error={fieldState.error?.message}
                    disabled={isPending}
                  />
                )}
              />
              <Controller
                name="segment"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LeadSegmentField
                    id="lead-record-segment"
                    label="Segmento"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                  />
                )}
              />
              <Controller
                name="state_code"
                control={form.control}
                render={({ field: stateField, fieldState: stateState }) => (
                  <Controller
                    name="city"
                    control={form.control}
                    render={({ field: cityField, fieldState: cityState }) => (
                      <LeadLocationField
                        id="lead-record-location"
                        value={{
                          state_code: stateField.value,
                          city: cityField.value,
                        }}
                        onValueChange={(next) => {
                          stateField.onChange(next.state_code)
                          cityField.onChange(next.city)
                        }}
                        onBlur={() => {
                          stateField.onBlur()
                          cityField.onBlur()
                        }}
                        stateError={stateState.error?.message}
                        cityError={cityState.error?.message}
                        disabled={isPending}
                      />
                    )}
                  />
                )}
              />
              <Controller
                name="tags"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LeadTagField
                    id="lead-record-tags"
                    label="Tags"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                  />
                )}
              />
            </div>
            {serverMessage ? (
              <ServerMessage
                text={serverMessage.text}
                existingLeadId={serverMessage.existingLeadId}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <LeadRecordField
              icon={RiBuilding4Line}
              label="Nome da empresa"
              value={lead.company_name}
            />
            <LeadDigitalChannelList
              channels={toDigitalChannelDrafts(lead.channels ?? [])}
            />
            <LeadRecordField
              icon={RiStore2Line}
              label="Segmento"
              value={detail.segment?.name ?? "—"}
            />
            <LeadRecordField
              icon={RiStore2Line}
              label="Localização"
              value={
                lead.city && lead.state_code
                  ? `${lead.city} · ${lead.state_code}`
                  : "—"
              }
            />
            <div className="border-t border-border/70 pt-4">
              <p className="mb-2 text-xs/relaxed text-muted-foreground">Tags</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <LeadTagChips tags={detail.tags} />
                {readOnly || !showActions ? null : (
                  <button
                    type="button"
                    aria-label="Adicionar tag"
                    onClick={onEdit}
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-primary transition-colors duration-150 ease-out hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <RiAddLine size={14} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </LeadRecordSectionCard>
    </form>
  )
}

function ContactCard({
  detail,
  editing,
  readOnly,
  showActions,
  onEdit,
  onCancel,
  onSaved,
  onPendingChange,
}: {
  detail: LeadDetail
  editing: boolean
  readOnly: boolean
  showActions: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: (fields: LeadWritePayload, tags: LeadTag[]) => void
  onPendingChange: (pending: boolean) => void
}) {
  const lead = detail.lead
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema) as Resolver<ContactValues>,
    defaultValues: contactDefaults(lead),
  })

  useEffect(() => {
    onPendingChange(isPending)
    return () => onPendingChange(false)
  }, [isPending, onPendingChange])

  useEffect(() => {
    if (!editing) return
    form.reset(contactDefaults(lead))
    setServerMessage(null)
  }, [editing])

  function onSubmit(values: ContactValues) {
    setServerMessage(null)
    const formData = new FormData()
    fillLeadFormData(
      formData,
      lead,
      detail.tags.map((tag) => tag.name),
      {
        contact_name: values.contact_name,
        phone: values.phone,
        email: values.email,
      },
    )

    startTransition(async () => {
      const result = await updateLead(formData)
      if (result.status === "error") {
        applyNamedErrors(form, result.fieldErrors)
        setServerMessage(result.message ?? "Revise os dados do lead.")
        return
      }
      onSaved(result.fields, result.tags)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <LeadRecordSectionCard
        icon={RiUserLine}
        title="Contato"
        editing={editing}
        editLabel="Editar contato"
        readOnly={readOnly}
        pending={isPending}
        saveDisabled={!form.formState.isDirty}
        showActions={showActions}
        onEdit={onEdit}
        onCancel={onCancel}
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="contact_name"
                control={form.control}
                render={({ field, fieldState }) => {
                  const errorId = "lead-record-contact-name-error"
                  return (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel htmlFor="lead-record-contact-name">
                        Nome do contato
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <RiUserLine aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="lead-record-contact-name"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isPending}
                          autoComplete="name"
                          aria-invalid={!!fieldState.error}
                          aria-describedby={
                            fieldState.error ? errorId : undefined
                          }
                        />
                      </InputGroup>
                      <FieldError id={errorId}>
                        {fieldState.error?.message}
                      </FieldError>
                    </Field>
                  )
                }}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => {
                  const errorId = "lead-record-phone-error"
                  return (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel htmlFor="lead-record-phone">
                        Telefone
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <RiPhoneLine aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="lead-record-phone"
                          type="tel"
                          inputMode="tel"
                          placeholder="(11) 98765-4321"
                          value={formatPhone(field.value)}
                          onChange={(event) =>
                            field.onChange(formatPhone(event.target.value))
                          }
                          onBlur={field.onBlur}
                          disabled={isPending}
                          autoComplete="tel"
                          aria-invalid={!!fieldState.error}
                          aria-describedby={
                            fieldState.error ? errorId : undefined
                          }
                        />
                      </InputGroup>
                      <FieldError id={errorId}>
                        {fieldState.error?.message}
                      </FieldError>
                    </Field>
                  )
                }}
              />
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => {
                  const errorId = "lead-record-email-error"
                  return (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel htmlFor="lead-record-email">
                        E-mail
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <RiMailLine aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="lead-record-email"
                          type="email"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isPending}
                          autoComplete="email"
                          aria-invalid={!!fieldState.error}
                          aria-describedby={
                            fieldState.error ? errorId : undefined
                          }
                        />
                      </InputGroup>
                      <FieldError id={errorId}>
                        {fieldState.error?.message}
                      </FieldError>
                    </Field>
                  )
                }}
              />
            </div>
            {serverMessage ? <ServerMessage text={serverMessage} /> : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <LeadRecordField
              icon={RiUserLine}
              label="Nome do contato"
              value={lead.contact_name}
            />
            <LeadRecordField
              icon={RiPhoneLine}
              label="Telefone"
              value={lead.phone ? formatPhone(lead.phone) : lead.phone}
              href={lead.phone ? toTelHref(lead.phone) : null}
            />
            <LeadRecordField
              icon={RiMailLine}
              label="E-mail"
              value={lead.email}
              href={lead.email ? `mailto:${lead.email}` : null}
            />
          </div>
        )}
      </LeadRecordSectionCard>
    </form>
  )
}

function NotesCard({
  detail,
  editing,
  readOnly,
  showActions,
  onEdit,
  onCancel,
  onSaved,
  onPendingChange,
}: {
  detail: LeadDetail
  editing: boolean
  readOnly: boolean
  showActions: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: (fields: LeadWritePayload, tags: LeadTag[]) => void
  onPendingChange: (pending: boolean) => void
}) {
  const lead = detail.lead
  const empty = !lead.observations?.trim()
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const form = useForm<NotesValues>({
    resolver: zodResolver(notesSchema) as Resolver<NotesValues>,
    defaultValues: { observations: lead.observations ?? "" },
  })

  const observations = form.watch("observations")

  useEffect(() => {
    onPendingChange(isPending)
    return () => onPendingChange(false)
  }, [isPending, onPendingChange])

  useEffect(() => {
    if (!editing) return
    form.reset({ observations: lead.observations ?? "" })
    setServerMessage(null)
  }, [editing])

  function onSubmit(values: NotesValues) {
    setServerMessage(null)
    const formData = new FormData()
    fillLeadFormData(
      formData,
      lead,
      detail.tags.map((tag) => tag.name),
      { observations: values.observations },
    )

    startTransition(async () => {
      const result = await updateLead(formData)
      if (result.status === "error") {
        applyNamedErrors(form, result.fieldErrors)
        setServerMessage(result.message ?? "Revise os dados do lead.")
        return
      }
      onSaved(result.fields, result.tags)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <LeadRecordSectionCard
        icon={RiChat3Line}
        title="Observações"
        subtitle="Notas internas sobre este lead"
        editing={editing}
        editLabel={empty ? "Adicionar observação" : "Editar observação"}
        readOnly={readOnly}
        pending={isPending}
        saveDisabled={!form.formState.isDirty}
        showActions={showActions}
        onEdit={onEdit}
        onCancel={onCancel}
      >
        {editing ? (
          <div className="flex flex-col gap-3">
            <Controller
              name="observations"
              control={form.control}
              render={({ field, fieldState }) => (
                <div>
                  <label
                    htmlFor="lead-record-observations"
                    className="mb-1.5 block text-xs/relaxed text-muted-foreground"
                  >
                    Observação
                  </label>
                  <Textarea
                    id="lead-record-observations"
                    rows={5}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={isPending}
                    maxLength={LEAD_OBSERVATIONS_MAX}
                    placeholder="Informações importantes ou observações sobre este lead"
                    aria-invalid={fieldState.error ? true : undefined}
                    className="min-h-0 resize-none"
                  />
                  <p className="mt-1 text-right text-xs/relaxed tabular-nums text-muted-foreground">
                    {observations.length}/{LEAD_OBSERVATIONS_MAX}
                  </p>
                  {fieldState.error?.message ? (
                    <p
                      role="alert"
                      className="mt-1 text-xs/relaxed text-destructive"
                    >
                      {fieldState.error.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            {serverMessage ? <ServerMessage text={serverMessage} /> : null}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center gap-3 px-4 py-6">
            <span
              aria-hidden
              className="inline-flex size-12 items-center justify-center rounded-xl bg-accent text-muted-foreground"
            >
              <RiFileTextLine size={22} />
            </span>
            <div className="max-w-sm text-center">
              <p className="text-xs/relaxed text-muted-foreground">
                Nenhuma observação cadastrada
              </p>
              <p className="mt-1 text-xs/relaxed text-muted-foreground">
                Informações importantes ou observações sobre este lead.
              </p>
            </div>
            {readOnly || !showActions ? null : (
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer text-xs/relaxed font-medium text-primary transition-colors duration-150 ease-out hover:text-primary"
              >
                Adicionar observação
              </button>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-xs/relaxed text-muted-foreground">
            {lead.observations}
          </p>
        )}
      </LeadRecordSectionCard>
    </form>
  )
}

function companyDefaults(detail: LeadDetail): CompanyValues {
  return {
    company_name: detail.lead.company_name,
    channels: toDigitalChannelDrafts(detail.lead.channels ?? []),
    segment: detail.segment?.name ?? "",
    state_code: detail.lead.state_code ?? "",
    city: detail.lead.city ?? "",
    tags: detail.tags.map((tag) => tag.name),
  }
}

function contactDefaults(lead: LeadRecord): ContactValues {
  return {
    contact_name: lead.contact_name ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
  }
}

function ServerMessage({
  text,
  existingLeadId,
}: {
  text: string
  existingLeadId?: string
}) {
  return (
    <p role="alert" className="text-xs/relaxed text-destructive">
      {text}
      {existingLeadId ? (
        <>
          {" "}
          <Link
            href={`/leads?lead=${existingLeadId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Abrir cadastro existente
          </Link>
        </>
      ) : null}
    </p>
  )
}

function RecordSkeleton() {
  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-border/70 bg-popover lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-3 px-4 py-5 sm:px-5">
          <span className="h-12 animate-pulse rounded-lg bg-accent motion-reduce:animate-none" />
          <span
            className="h-12 animate-pulse rounded-lg bg-accent motion-reduce:animate-none"
            style={{ animationDelay: "40ms" }}
          />
          <span
            className="h-12 animate-pulse rounded-lg bg-accent motion-reduce:animate-none"
            style={{ animationDelay: "80ms" }}
          />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5">
        <span className="h-44 animate-pulse rounded-xl bg-accent motion-reduce:animate-none" />
        <span
          className="h-36 animate-pulse rounded-xl bg-accent motion-reduce:animate-none"
          style={{ animationDelay: "40ms" }}
        />
        <span
          className="h-40 animate-pulse rounded-xl bg-accent motion-reduce:animate-none"
          style={{ animationDelay: "80ms" }}
        />
      </div>
    </div>
  )
}
