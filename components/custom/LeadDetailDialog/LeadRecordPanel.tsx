"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Controller, useForm, type FieldValues, type Path, type Resolver, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  RiAddLine,
  RiBuilding4Line,
  RiChat3Line,
  RiFileTextLine,
  RiGlobalLine,
  RiInstagramLine,
  RiLinkedinBoxLine,
  RiMailLine,
  RiPhoneLine,
  RiUserLine,
} from "react-icons/ri"
import { updateLead } from "@/app/actions/leads"
import { LeadTagChips, LeadTagField } from "@/components/custom/LeadTagField"
import { Input } from "@/components/ui/Input"
import { formatPhone, toTelHref } from "@/lib/br-documents"
import { cn } from "@/lib/cn"
import type { LeadDetail } from "@/app/actions/leads"
import type { LeadTag } from "@/lib/leads/tags"
import type { LeadRecord, LeadWritePayload } from "@/lib/leads/types"
import {
  LEAD_OBSERVATIONS_MAX,
  leadFormSchema,
  type LeadFieldName,
} from "@/lib/validations/lead"
import { hrefForWebsite, LeadRecordField } from "./LeadRecordField"
import { LeadRecordRail, type LeadRecordSection } from "./LeadRecordRail"
import { LeadRecordSectionCard } from "./LeadRecordSectionCard"

const companySchema = leadFormSchema.pick({
  company_name: true,
  website: true,
  instagram: true,
  linkedin: true,
  tags: true,
})

const contactSchema = leadFormSchema.pick({
  contact_name: true,
  phone: true,
  email: true,
})

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
    website?: string
    instagram?: string
    linkedin?: string
    contact_name?: string
    phone?: string
    email?: string
    observations?: string
  },
) {
  formData.set("lead_id", lead.id)
  formData.set("company_name", overlay.company_name ?? lead.company_name)
  formData.set("website", overlay.website ?? lead.website)
  formData.set("instagram", overlay.instagram ?? lead.instagram ?? "")
  formData.set("linkedin", overlay.linkedin ?? lead.linkedin ?? "")
  formData.set("contact_name", overlay.contact_name ?? lead.contact_name ?? "")
  formData.set("phone", overlay.phone ?? lead.phone ?? "")
  formData.set("email", overlay.email ?? lead.email ?? "")
  formData.set(
    "observations",
    overlay.observations ?? lead.observations ?? "",
  )
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
      <aside className="border-b border-border-subtle bg-elevated lg:border-r lg:border-b-0">
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
            showActions={sectionEditing === null || sectionEditing === "company"}
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
            showActions={sectionEditing === null || sectionEditing === "contact"}
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
      website: values.website,
      instagram: values.instagram,
      linkedin: values.linkedin,
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
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <LeadRecordSectionCard
        icon={RiBuilding4Line}
        title="Empresa"
        editing={editing}
        editLabel="Editar empresa"
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
                name="company_name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-company-name"
                    label="Nome da empresa"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    autoComplete="organization"
                    leadingIcon={<RiBuilding4Line size={16} aria-hidden />}
                  />
                )}
              />
              <Controller
                name="website"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-website"
                    label="Site"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    placeholder="empresa.com.br"
                    autoComplete="url"
                    leadingIcon={<RiGlobalLine size={16} aria-hidden />}
                  />
                )}
              />
              <Controller
                name="instagram"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-instagram"
                    label="Instagram"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    leadingIcon={<RiInstagramLine size={16} aria-hidden />}
                  />
                )}
              />
              <Controller
                name="linkedin"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-linkedin"
                    label="LinkedIn"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    leadingIcon={<RiLinkedinBoxLine size={16} aria-hidden />}
                  />
                )}
              />
              <div className="sm:col-span-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <LeadRecordField
                icon={RiBuilding4Line}
                label="Nome da empresa"
                value={lead.company_name}
              />
              <LeadRecordField
                icon={RiGlobalLine}
                label="Site"
                value={lead.website_domain}
                href={hrefForWebsite(lead.website || lead.website_domain)}
              />
              <LeadRecordField
                icon={RiInstagramLine}
                label="Instagram"
                value={lead.instagram}
                href={hrefForWebsite(lead.instagram)}
              />
              <LeadRecordField
                icon={RiLinkedinBoxLine}
                label="LinkedIn"
                value={lead.linkedin}
                href={hrefForWebsite(lead.linkedin)}
              />
            </div>
            <div className="border-t border-border-subtle pt-4">
              <p className="mb-2 font-sans text-caption text-fg-muted">Tags</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <LeadTagChips tags={detail.tags} />
                {readOnly || !showActions ? null : (
                  <button
                    type="button"
                    aria-label="Adicionar tag"
                    onClick={onEdit}
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-accent transition-colors duration-150 ease-out hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-contact-name"
                    label="Nome do contato"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    autoComplete="name"
                    leadingIcon={<RiUserLine size={16} aria-hidden />}
                  />
                )}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-phone"
                    variant="phone"
                    label="Telefone"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    autoComplete="tel"
                    leadingIcon={<RiPhoneLine size={16} aria-hidden />}
                  />
                )}
              />
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="lead-record-email"
                    variant="email"
                    label="E-mail"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabled={isPending}
                    autoComplete="email"
                    leadingIcon={<RiMailLine size={16} aria-hidden />}
                  />
                )}
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
                    className="mb-1.5 block font-sans text-caption text-fg-secondary"
                  >
                    Observação
                  </label>
                  <textarea
                    id="lead-record-observations"
                    rows={5}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={isPending}
                    maxLength={LEAD_OBSERVATIONS_MAX}
                    placeholder="Informações importantes ou observações sobre este lead"
                    aria-invalid={fieldState.error ? true : undefined}
                    className={cn(
                      "w-full resize-none rounded-md border border-input-border bg-input px-3 py-2",
                      "font-sans text-body-sm text-fg outline-none",
                      "placeholder:text-fg-muted",
                      "transition-[border-color,opacity] duration-150 ease-out",
                      "focus-visible:border-accent",
                      "disabled:opacity-50",
                      fieldState.error &&
                        "border-danger focus-visible:border-danger",
                    )}
                  />
                  <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
                    {observations.length}/{LEAD_OBSERVATIONS_MAX}
                  </p>
                  {fieldState.error?.message ? (
                    <p role="alert" className="mt-1 font-sans text-caption text-danger">
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
              className="inline-flex size-12 items-center justify-center rounded-xl bg-hover text-fg-muted"
            >
              <RiFileTextLine size={22} />
            </span>
            <div className="max-w-sm text-center">
              <p className="font-sans text-body-sm text-fg-secondary">
                Nenhuma observação cadastrada
              </p>
              <p className="mt-1 font-sans text-caption text-fg-muted">
                Informações importantes ou observações sobre este lead.
              </p>
            </div>
            {readOnly || !showActions ? null : (
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer font-sans text-body-sm font-medium text-accent transition-colors duration-150 ease-out hover:text-accent-hover"
              >
                Adicionar observação
              </button>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap font-sans text-body-sm text-fg-secondary">
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
    website: detail.lead.website,
    instagram: detail.lead.instagram ?? "",
    linkedin: detail.lead.linkedin ?? "",
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
    <p role="alert" className="font-sans text-body-sm text-danger">
      {text}
      {existingLeadId ? (
        <>
          {" "}
          <Link
            href={`/leads?lead=${existingLeadId}`}
            className="font-medium text-link underline-offset-2 hover:underline"
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
      <aside className="border-b border-border-subtle bg-elevated lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-3 px-4 py-5 sm:px-5">
          <span className="h-12 animate-pulse rounded-lg bg-hover motion-reduce:animate-none" />
          <span
            className="h-12 animate-pulse rounded-lg bg-hover motion-reduce:animate-none"
            style={{ animationDelay: "40ms" }}
          />
          <span
            className="h-12 animate-pulse rounded-lg bg-hover motion-reduce:animate-none"
            style={{ animationDelay: "80ms" }}
          />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5">
        <span className="h-44 animate-pulse rounded-xl bg-hover motion-reduce:animate-none" />
        <span
          className="h-36 animate-pulse rounded-xl bg-hover motion-reduce:animate-none"
          style={{ animationDelay: "40ms" }}
        />
        <span
          className="h-40 animate-pulse rounded-xl bg-hover motion-reduce:animate-none"
          style={{ animationDelay: "80ms" }}
        />
      </div>
    </div>
  )
}
