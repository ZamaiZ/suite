import type { ReactNode } from "react"
import { cn } from "cn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Card de seção das etapas de auditoria.
 *
 * Nasceu como `LeadGbpCard`, dentro da pasta do Perfil no Google, e acabou
 * consumido por Website, Presença digital, Diagnóstico e Visibilidade — dezoito
 * arquivos, treze deles fora do dono. Era um primitive do shell morando na
 * pasta errada, e etapa importando componente de etapa vizinha é acoplamento
 * que não se justifica.
 *
 * A API é a mesma de antes: mover o arquivo é refatoração de local, não de
 * aparência.
 */
export function StepCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card size="sm" render={<section />} className={cn("min-h-0", className)}>
      <CardHeader>
        <CardTitle render={<h3 />} className="font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{children}</CardContent>
    </Card>
  )
}
