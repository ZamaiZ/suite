"use client"

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react"
import Link from "next/link"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { IconType } from "react-icons"
import {
  RiBuilding4Line,
  RiGlobalLine,
  RiMailLine,
  RiPhoneLine,
  RiPriceTag3Line,
  RiSaveLine,
  RiStore2Line,
  RiUserLine,
} from "react-icons/ri"
import { createLead, updateLead } from "@/app/actions/leads"
import {
  LeadDigitalChannels,
  type LeadDigitalChannelsHandle,
} from "@/components/custom/LeadDigitalChannels"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { LeadLocationField } from "@/components/custom/LeadLocationField"
import { LeadSegmentField } from "@/components/custom/LeadSegmentField"
import { LeadTagField } from "@/components/custom/LeadTagField"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { formatPhone } from "@/lib/br-documents"
import { cn } from "cn"
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
    <section className="rounded-xl bg-card p-4 shadow-xs">
      <div className="mb-4 flex items-center gap-2.5">
        <LeadIconWell icon={icon} />
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-xs/relaxed text-muted-foreground">{subtitle}</p>
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
      cnpj: defaultValues?.cnpj ?? lead?.cnpj ?? "",
      channels:
        defaultValues?.channels ??
        (lead?.channels ? toDigitalChannelDrafts(lead.channels) : []),
      segment: defaultValues?.segment ?? lead?.segment?.name ?? "",
      state_code: defaultValues?.state_code ?? lead?.state_code ?? "",
      city: defaultValues?.city ?? lead?.city ?? "",
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
    formData.set("cnpj", values.cnpj)
    formData.set("segment", values.segment)
    formData.set("state_code", values.state_code)
    formData.set("city", values.city)
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
        mode === "create"
          ? await createLead(formData)
          : await updateLead(formData)

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
          name="cnpj"
          control={form.control}
          render={({ field, fieldState }) => {
            const errorId = "lead-cnpj-error"
            return (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="lead-cnpj">CNPJ</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="lead-cnpj"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={fieldsDisabled}
                    autoComplete="off"
                    maxLength={18}
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? errorId : undefined}
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
          name="company_name"
          control={form.control}
          render={({ field, fieldState }) => {
            const errorId = "lead-company-name-error"
            return (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="lead-company-name">
                  Nome da empresa
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiBuilding4Line aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="lead-company-name"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={fieldsDisabled}
                    autoComplete="organization"
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                </InputGroup>
                <FieldError id={errorId}>
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )
          }}
        />
      </FormSection>

      <FormSection
        icon={RiStore2Line}
        title="Segmento e localização"
        subtitle="Segmento do lead em potencial e região de atuação."
        columns="one"
      >
        <Controller
          name="segment"
          control={form.control}
          render={({ field, fieldState }) => (
            <LeadSegmentField
              id="lead-segment"
              label="Segmento"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={fieldsDisabled}
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
                  id="lead-location"
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
                  disabled={fieldsDisabled}
                />
              )}
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
          render={({ field, fieldState }) => {
            const errorId = "lead-contact-name-error"
            return (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="lead-contact-name">
                  Nome do contato
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiUserLine aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="lead-contact-name"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={fieldsDisabled}
                    autoComplete="name"
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? errorId : undefined}
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
            const errorId = "lead-phone-error"
            return (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="lead-phone">Telefone</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiPhoneLine aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="lead-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="(11) 98765-4321"
                    value={formatPhone(field.value)}
                    onChange={(event) =>
                      field.onChange(formatPhone(event.target.value))
                    }
                    onBlur={field.onBlur}
                    disabled={fieldsDisabled}
                    autoComplete="tel"
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? errorId : undefined}
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
            const errorId = "lead-email-error"
            return (
              <Field
                className="sm:col-span-2"
                data-invalid={!!fieldState.error}
              >
                <FieldLabel htmlFor="lead-email">E-mail</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiMailLine aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="lead-email"
                    type="email"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={fieldsDisabled}
                    autoComplete="email"
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                </InputGroup>
                <FieldError id={errorId}>
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )
          }}
        />
      </FormSection>

      {serverMessage ? (
        <p
          role={serverMessage.tone === "error" ? "alert" : "status"}
          className={cn(
            "text-xs/relaxed",
            serverMessage.tone === "error"
              ? "text-destructive"
              : "text-success",
          )}
        >
          {serverMessage.text}
          {serverMessage.existingLeadId ? (
            <>
              {" "}
              <Link
                href={`/leads?lead=${serverMessage.existingLeadId}`}
                className="font-medium text-primary underline-offset-2 hover:underline"
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
          >
            {isPending ? (
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiSaveLine data-icon="inline-start" aria-hidden />
            )}
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
