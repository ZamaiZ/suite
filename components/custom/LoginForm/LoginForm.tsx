"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiLoginBoxLine,
  RiMailLine,
  RiLockPasswordLine,
  RiEyeLine,
  RiEyeOffLine,
} from "react-icons/ri"
import { loginSchema, type LoginInput } from "@/lib/validations/login"
import { login } from "@/app/actions/login"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const FIELD_CONTAINER = {
  hidden: {},
  visible: { transition: { delayChildren: 0.62, staggerChildren: 0.055 } },
}

const FIELD_CONTAINER_REDUCED = {
  hidden: {},
  visible: { transition: { delayChildren: 0, staggerChildren: 0 } },
}

const FIELD_ITEM = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
}

const FIELD_ITEM_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
}

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const reduced = !!useReducedMotion()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  function onSubmit(data: LoginInput) {
    setServerMessage(null)

    const formData = new FormData()
    formData.set("email", data.email)
    formData.set("password", data.password)

    startTransition(async () => {
      const result = await login(formData)

      if (result.status === "error") {
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
    <m.form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <m.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-4"
      >
        <m.div variants={fieldItem}>
          <Field data-invalid={Boolean(form.formState.errors.email)}>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiMailLine size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                disabled={isPending}
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </InputGroup>
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
        </m.div>

        <m.div variants={fieldItem}>
          <Field data-invalid={Boolean(form.formState.errors.password)}>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiLockPasswordLine size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Sua senha"
                disabled={isPending}
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={
                    passwordVisible ? "Ocultar senha" : "Exibir senha"
                  }
                >
                  {passwordVisible ? (
                    <RiEyeOffLine aria-hidden />
                  ) : (
                    <RiEyeLine aria-hidden />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
        </m.div>

        {serverMessage && (
          <m.p
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.18, ease: EASE },
            }}
            className="text-sm text-destructive"
          >
            {serverMessage}
          </m.p>
        )}

        <m.div variants={fieldItem}>
          <Button
            type="submit"
            variant="default"
            disabled={isPending}
            size="lg"
            className="w-full"
          >
            {isPending ? (
              <Spinner aria-hidden className="size-4" />
            ) : (
              <RiLoginBoxLine aria-hidden />
            )}
            {isPending ? "Entrando…" : "Entrar"}
          </Button>
        </m.div>

        <m.p
          variants={fieldItem}
          className="text-center text-sm text-muted-foreground"
        >
          Não tem uma conta?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            Criar conta
          </Link>
        </m.p>
      </m.div>
    </m.form>
  )
}
