"use client"

import { useState } from "react"
import Link from "next/link"
import { RiAddLine, RiRadarLine } from "react-icons/ri"

import type { CampaignListItem } from "@/app/actions/prospect"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { ProspectCampaignForm } from "./ProspectCampaignForm"

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})
const NUM = new Intl.NumberFormat("pt-BR")
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" })

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  discovering: "Coletando",
  discovered: "Pronta",
  failed: "Falhou",
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  discovering: "secondary",
  discovered: "default",
  failed: "destructive",
}

export function ProspectCampaigns({
  campaigns,
  totalCostUsd,
}: {
  campaigns: CampaignListItem[]
  totalCostUsd: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Prospecção</h1>
          <p className="text-muted-foreground text-xs/relaxed">
            Listas de empresas por segmento e região, com CNPJ, quadro
            societário e contato.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* O custo somado fica à vista. A primeira fatura grande virar
              surpresa é literalmente o incidente que fundou o padrão de fila
              deste repositório. */}
          <p className="text-muted-foreground text-xs/relaxed">
            Gasto total{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {CURRENCY.format(totalCostUsd)}
            </span>
          </p>
          <Button onClick={() => setOpen(true)}>
            <RiAddLine aria-hidden />
            Nova campanha
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova campanha</DialogTitle>
                <DialogDescription>
                  Escolha o segmento e a região. A estimativa mostra quantas
                  empresas existem e quanto custa antes de você confirmar.
                </DialogDescription>
              </DialogHeader>
              <ProspectCampaignForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {campaigns.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiRadarLine aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nenhuma campanha ainda</EmptyTitle>
            <EmptyDescription>
              Uma campanha é um segmento numa região — &ldquo;dentistas num raio
              de 10 km de Guarulhos&rdquo;. A suite descobre as empresas,
              encontra o CNPJ e procura o contato.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)}>
              <RiAddLine aria-hidden />
              Criar a primeira
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Região</TableHead>
              <TableHead className="text-right">Descobertas</TableHead>
              <TableHead className="text-right">Promovidas</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Criada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/prospeccao/${c.id}`}
                    className="hover:text-primary font-medium underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground block truncate text-xs">
                    {c.categories.join(", ") || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.city}/{c.stateCode}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {NUM.format(c.discoveredCount)}
                  <span className="text-muted-foreground">
                    {" "}
                    / {NUM.format(c.targetCount)}
                  </span>
                  {c.universeCount ? (
                    <span className="text-muted-foreground block text-xs">
                      de {NUM.format(c.universeCount)} na área
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.promotedCount > 0 ? NUM.format(c.promotedCount) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {CURRENCY.format(c.costUsd)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {DATA.format(new Date(c.createdAt))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
