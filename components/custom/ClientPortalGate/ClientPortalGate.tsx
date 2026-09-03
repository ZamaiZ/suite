"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { authenticateClientPortal } from "@/app/actions/clients"
import { Button } from "@/components/ui/Button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/InputOTP"
import { PORTAL_CODE_LENGTH } from "@/lib/clients/portal-code"
import type { ClientPortalGateProps } from "./ClientPortalGate.types"

export function ClientPortalGate({ slug }: ClientPortalGateProps) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const submittingRef = useRef(false)

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
      <InputOTP
        id="client-portal-code"
        name="code"
        maxLength={PORTAL_CODE_LENGTH}
        variant="mixed"
        value={code}
        onChange={setCode}
        onComplete={submit}
        disabled={isPending}
        error={Boolean(error)}
        label="Código de acesso"
        containerClassName="justify-center"
      >
        <InputOTPGroup>
          {Array.from({ length: PORTAL_CODE_LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>

      {error ? (
        <p role="alert" className="text-center font-sans text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending || code.length !== PORTAL_CODE_LENGTH}>
        {isPending ? "Validando..." : "Entrar"}
      </Button>
    </form>
  )
}
