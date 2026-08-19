"use client"

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { IconType } from "react-icons"
import {
  RiBuilding4Line,
  RiGlobalLine,
  RiLoader4Line,
  RiMailLine,
  RiPhoneLine,
  RiPriceTag3Line,
  RiSaveLine,
  RiUserLine,
} from "react-icons/ri"
import { createLead, updateLead } from "@/app/actions/leads"
import {
  LeadDigitalChannels,
  type LeadDigitalChannelsHandle,
} from "@/components/custom/LeadDigitalChannels"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { LeadTagField } from "@/components/custom/LeadTagField"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/cn"
import { toDigitalChannelDrafts } from "@/lib/leads/digital-channels"
import {
  leadFormSchema,
  type LeadFieldName,
  type LeadFormValues,
} from "@/lib/validations/lead"
import { LEAD_FORM_ID, type LeadFormProps } from "./LeadForm.types"

function applyFieldErrors(
  form: ReturnType<typeof useForm<LeadFormValues>>,
  fieldErrors?: Partial<Record<LeadFieldName, string[]>>,
) {
  if (!fieldErrors) return
  const values = form.getValues()
  ;(Object.keys(fieldErrors) as LeadFieldName[]).forEach((key) => {
    if (!(key in values)) return
    const message = fieldErrors[key]?.[0]
    if (message) form.setError(key as keyof LeadFormValues, { message })
  })
}

function FormSection({
  icon,
  title,
  subtitle,
  columns = "two",
  children,
}: {
  icon: IconType
  title: string
  subtitle: string
  columns?: "one" | "two"
  children: ReactNode
}) {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <LeadIconWell icon={icon} />
        <div className="min-w-0">
          <h3 className="font-sans text-body-sm font-semibold text-fg">
            {title}
          </h3>
          <p className="font-sans text-caption text-fg-muted">{subtitle}</p>
        </div>
      </div>
      <div
        className={cn(
          "grid gap-4",
          columns === "two" ? "sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function LeadForm({
  mode,
  leadId,
  defaultValues,
  lead,
  initialTags,
  onSuccess,
  onPendingChange,
  onDirtyChange,
  hideSubmit = false,
  readOnly = false,
}: LeadFormProps) {
  const [isPending, startTransition] = useTransition()
  const channelsRef = useRef<LeadDigitalChannelsHandle>(null)
  const [serverMessage, setServerMessage] = useState<{
    tone: "success" | "error"
    text: string
    existingLeadId?: string
  } | null>(null)

  useEffect(() => {
    onPendingChange?.(isPending)
    return () => onPendingChange?.(false)
  }, [isPending, onPendingChange])

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as Resolver<LeadFormValues>,
    defaultValues: {
      company_name: defaultValues?.company_name ?? lead?.company_name ?? "",
      channels:
        defaultValues?.channels ??
        (lead?.channels ? toDigitalChannelDrafts(lead.channels) : []),
      contact_name: defaultValues?.contact_name ?? lead?.contact_name ?? "",
      phone: defaultValues?.phone ?? lead?.phone ?? "",
      email: defaultValues?.email ?? lead?.email ?? "",
      tags: defaultValues?.tags ?? initialTags?.map((tag) => tag.name) ?? [],
    },
  })

  const isDirty = form.formState.isDirty

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function onSubmit(values: LeadFormValues) {
    if (readOnly) return
    setServerMessage(null)
    const formData = new FormData()
    if (mode === "edit" && leadId) formData.set("lead_id", leadId)
    formData.set("company_name", values.company_name)
    formData.set("channels", JSON.stringify(values.channels))
    formData.set("contact_name", values.contact_name)
    formData.set("phone", values.phone)
    formData.set("email", values.email)
    if (mode === "edit") {
      formData.set("observations", lead?.observations ?? "")
    }
    for (const tag of values.tags) formData.append("tags", tag)

    startTransition(async () => {
      const result =
        mode === "create" ? await createLead(formData) : await updateLead(formData)

      if (result.status === "error") {
        applyFieldErrors(form, result.fieldErrors)
        setServerMessage({
          tone: "error",
          text: result.message ?? "Revise os dados do lead.",
          existingLeadId: result.existingLeadId,
        })
        return
      }

      if (mode === "edit") {
        if (!("fields" in result)) return
        form.reset(values)
        setServerMessage({ tone: "success", text: result.message })
        onSuccess?.({ kind: "edit", fields: result.fields, tags: result.tags })
        return
      }

      if (!("item" in result)) return
      onSuccess?.({ kind: "create", item: result.item })
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (channelsRef.current && !channelsRef.current.flush()) {
      event.preventDefault()
      return
    }
    void form.handleSubmit(onSubmit)(event)
  }

  const fieldsDisabled = isPending || readOnly

  return (
    <form
      id={LEAD_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormSection
        icon={RiBuilding4Line}
        title="Empresa"
        subtitle="Informações principais da empresa."
        columns="one"
      >
        <Controller
          name="company_name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              id="lead-company-name"
              label="Nome da empresa"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
              autoComplete="organization"
              leadingIcon={<RiBuilding4Line size={16} aria-hidden />}
            />
          )}
        />
      </FormSection>

      <FormSection
        icon={RiGlobalLine}
        title="Canais digitais"
        subtitle="Adicione os sites e perfis da empresa. Você pode incluir quantos canais forem necessários."
        columns="one"
      >
        <Controller
          name="channels"
          control={form.control}
          render={({ field, fieldState }) => (
            <LeadDigitalChannels
              ref={channelsRef}
              id="lead-channels"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
            />
          )}
        />
      </FormSection>

      <FormSection
        icon={RiPriceTag3Line}
        title="Tags"
        subtitle="Organize o lead com tags relevantes."
        columns="one"
      >
        <Controller
          name="tags"
          control={form.control}
          render={({ field, fieldState }) => (
            <LeadTagField
              id="lead-tags"
              label="Adicionar tag"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
            />
          )}
        />
      </FormSection>

      <FormSection
        icon={RiUserLine}
        title="Contato"
        subtitle="Pessoa responsável pelo contato."
      >
        <Controller
          name="contact_name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              id="lead-contact-name"
              label="Nome do contato"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
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
              id="lead-phone"
              variant="phone"
              label="Telefone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
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
              id="lead-email"
              variant="email"
              label="E-mail"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
              autoComplete="email"
              className="sm:col-span-2"
              leadingIcon={<RiMailLine size={16} aria-hidden />}
            />
          )}
        />
      </FormSection>

      {serverMessage ? (
        <p
          role={serverMessage.tone === "error" ? "alert" : "status"}
          className={cn(
            "font-sans text-body-sm",
            serverMessage.tone === "error" ? "text-danger" : "text-success",
          )}
        >
          {serverMessage.text}
          {serverMessage.existingLeadId ? (
            <>
              {" "}
              <Link
                href={`/leads?lead=${serverMessage.existingLeadId}`}
                className="font-medium text-link underline-offset-2 hover:underline"
              >
                Abrir cadastro existente
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {hideSubmit || readOnly ? null : (
        <div>
          <Button
            type="submit"
            disabled={isPending || (mode === "edit" && !form.formState.isDirty)}
            leadingIcon={
              isPending ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : (
                <RiSaveLine size={16} aria-hidden />
              )
            }
          >
            {isPending
              ? "Salvando…"
              : mode === "create"
                ? "Cadastrar lead"
                : "Salvar alterações"}
          </Button>
        </div>
      )}
    </form>
  )
}
