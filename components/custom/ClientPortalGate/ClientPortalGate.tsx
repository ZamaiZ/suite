"use client"

import { useRef, useState, useTransition } from "react"
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { useRouter } from "next/navigation"
import { authenticateClientPortal } from "@/app/actions/clients"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { PORTAL_CODE_LENGTH } from "@/lib/clients/portal-code"
import type { ClientPortalGateProps } from "./ClientPortalGate.types"

export function ClientPortalGate({ slug }: ClientPortalGateProps) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const submittingRef = useRef(false)
  const errorId = "client-portal-code-error"

  function normalizeCode(value: string) {
    return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  }

  function submit(nextCode: string) {
    if (nextCode.length !== PORTAL_CODE_LENGTH) return
    if (submittingRef.current || isPending) return
    submittingRef.current = true
    setError(null)
    const formData = new FormData()
    formData.set("slug", slug)
    formData.set("code", nextCode)

    startTransition(async () => {
      const result = await authenticateClientPortal(formData)
      submittingRef.current = false
      if (result.status === "error") {
        setError(result.message)
        setCode("")
        return
      }
      router.refresh()
    })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit(code)
      }}
    >
      <Field data-invalid={Boolean(error)} className="items-center">
        <FieldLabel htmlFor="client-portal-code">Código de acesso</FieldLabel>
        <InputOTP
          id="client-portal-code"
          name="code"
          maxLength={PORTAL_CODE_LENGTH}
          value={code}
          onChange={(value) => setCode(normalizeCode(value))}
          onComplete={(value) => submit(normalizeCode(value))}
          disabled={isPending}
          pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
          pasteTransformer={normalizeCode}
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            {Array.from({ length: PORTAL_CODE_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </Field>

      <Button type="submit" disabled={isPending || code.length !== PORTAL_CODE_LENGTH}>
        {isPending ? "Validando..." : "Entrar"}
      </Button>
    </form>
  )
}
