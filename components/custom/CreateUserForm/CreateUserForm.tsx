"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiUserAddLine,
  RiLoader4Line,
  RiUserLine,
  RiMailLine,
  RiLockPasswordLine,
} from "react-icons/ri"
import { createUserSchema, type CreateUserInput } from "@/lib/validations/create-user"
import { createUser } from "@/app/actions/create-user"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const FIELD_CONTAINER = {
  hidden:  {},
  visible: { transition: { delayChildren: 0.62, staggerChildren: 0.055 } },
}

const FIELD_CONTAINER_REDUCED = {
  hidden:  {},
  visible: { transition: { delayChildren: 0, staggerChildren: 0 } },
}

const FIELD_ITEM = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
}

const FIELD_ITEM_REDUCED = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
}

export function CreateUserForm() {
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const reduced = !!useReducedMotion()

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  function onSubmit(data: CreateUserInput) {
    setServerMessage(null)

    const formData = new FormData()
    formData.set("name",     data.name)
    formData.set("email",    data.email)
    formData.set("password", data.password)

    startTransition(async () => {
      const result = await createUser(formData)

      if (result.status === "error") {
        if (result.fieldErrors?.name) {
          form.setError("name", { message: result.fieldErrors.name[0] })
        }
        if (result.fieldErrors?.email) {
          form.setError("email", { message: result.fieldErrors.email[0] })
        }
        if (result.fieldErrors?.password) {
          form.setError("password", { message: result.fieldErrors.password[0] })
        }
        if (result.message) {
          setServerMessage(result.message)
        }
      }
    })
  }

  const container = reduced ? FIELD_CONTAINER_REDUCED : FIELD_CONTAINER
  const fieldItem = reduced ? FIELD_ITEM_REDUCED : FIELD_ITEM

  return (
    <m.form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <m.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-4"
      >
        <m.div variants={fieldItem}>
          <Input
            id="name"
            label="Nome"
            autoComplete="name"
            placeholder="Seu nome"
            disabled={isPending}
            error={form.formState.errors.name?.message}
            leadingIcon={<RiUserLine size={16} aria-hidden />}
            {...form.register("name")}
          />
        </m.div>

        <m.div variants={fieldItem}>
          <Input
            id="email"
            label="E-mail"
            variant="email"
            autoComplete="email"
            placeholder="seu@email.com"
            disabled={isPending}
            error={form.formState.errors.email?.message}
            leadingIcon={<RiMailLine size={16} aria-hidden />}
            {...form.register("email")}
          />
        </m.div>

        <m.div variants={fieldItem}>
          <Input
            id="password"
            label="Senha"
            variant="password"
            autoComplete="new-password"
            placeholder="Mínimo 12 caracteres"
            disabled={isPending}
            error={form.formState.errors.password?.message}
            leadingIcon={<RiLockPasswordLine size={16} aria-hidden />}
            {...form.register("password")}
          />
        </m.div>

        {serverMessage && (
          <m.p
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } }}
            className="font-sans text-body-sm text-danger"
          >
            {serverMessage}
          </m.p>
        )}

        <m.div variants={fieldItem}>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending}
            className="w-full"
            leadingIcon={
              isPending ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : (
                <RiUserAddLine size={16} aria-hidden />
              )
            }
          >
            {isPending ? "Criando conta…" : "Criar conta"}
          </Button>
        </m.div>

        <m.p
          variants={fieldItem}
          className="font-sans text-body-sm text-fg-muted text-center"
        >
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Entrar
          </Link>
        </m.p>
      </m.div>
    </m.form>
  )
}
