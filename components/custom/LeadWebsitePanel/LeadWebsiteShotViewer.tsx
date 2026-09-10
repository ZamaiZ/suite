"use client"

import { useState } from "react"
import { RiImageLine } from "react-icons/ri"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { WebsitePagespeedSnapshot } from "@/lib/leads/website-pagespeed"

type Device = "mobile" | "desktop"

/**
 * A captura ao lado do julgamento, não um card acima dele. A validação visual
 * pede para julgar "pelas capturas" — e elas moravam noutro bloco do scroll,
 * então responder seis critérios custava seis idas e voltas.
 */
export function LeadWebsiteShotViewer({
  pagespeed,
}: {
  pagespeed: WebsitePagespeedSnapshot | null
}) {
  const [device, setDevice] = useState<Device>("mobile")
  const [failed, setFailed] = useState<Device | null>(null)
  const src =
    device === "mobile"
      ? (pagespeed?.mobile?.screenshot ?? null)
      : (pagespeed?.desktop?.screenshot ?? null)

  return (
    <Card size="sm" render={<section />} className="min-h-0">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle render={<h3 />} className="font-semibold">
          Capturas
        </CardTitle>
        <ToggleGroup
          value={[device]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "mobile" || next === "desktop") setDevice(next)
          }}
          variant="outline"
          size="sm"
          aria-label="Dispositivo da captura"
        >
          <ToggleGroupItem value="mobile">Mobile</ToggleGroupItem>
          <ToggleGroupItem value="desktop">Desktop</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="min-w-0 flex-1">
        <div className="xl:sticky xl:top-0">
          {src && failed !== device ? (
            <img
              src={src}
              alt={`Captura ${device === "mobile" ? "mobile" : "desktop"}`}
              onError={() => setFailed(device)}
              className="max-h-[calc(100dvh-22rem)] w-full rounded-lg border border-border/70 bg-background object-cover object-top"
            />
          ) : (
            <div className="flex min-h-48 items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-background px-3 py-6">
              <RiImageLine
                size={16}
                aria-hidden
                className="text-muted-foreground"
              />
              <p className="text-xs/relaxed text-muted-foreground">
                Aguardando captura
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
