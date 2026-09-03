"use client"

import { useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "react-icons/ri"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import type { ClientPortalCodeRevealProps } from "./ClientPortalCodeReveal.types"

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function CopyRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyText(value)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-sans text-caption font-medium text-fg-secondary">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <p
          className={
            mono
              ? "min-w-0 flex-1 break-all font-sans text-body-sm font-semibold tracking-[0.18em] text-fg"
              : "min-w-0 flex-1 break-all font-sans text-body-sm text-fg"
          }
        >
          {value}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleCopy()}
          leadingIcon={
            copied ? (
              <RiCheckLine size={16} aria-hidden />
            ) : (
              <RiFileCopyLine size={16} aria-hidden />
            )
          }
        >
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  )
}

export function ClientPortalCodeReveal({
  open,
  onClose,
  code,
  url,
  title = "Guarde este código",
}: ClientPortalCodeRevealProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="O código não será exibido de novo. Copie agora ou será preciso rotacionar."
      footer={
        <Button type="button" onClick={onClose}>
          Entendi
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <CopyRow label="Código" value={code} mono />
        <CopyRow label="Link" value={url} />
      </div>
    </Dialog>
  )
}
