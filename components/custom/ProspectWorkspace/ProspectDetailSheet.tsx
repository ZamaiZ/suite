"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RiExternalLinkLine, RiUserSearchLine } from "react-icons/ri"

import { requestPersonLookup } from "@/app/actions/prospect"
import { formatCnpj, formatPhone } from "@/lib/br-documents"
import { CONFIDENCE_BAND_LABEL } from "@/lib/prospect/cnpj-match"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ProspectRow } from "./ProspectWorkspace.types"

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
})
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" })

/**
 * A ficha da empresa.
 *
 * `Sheet`, e não `Dialog`: o SDR passa de linha em linha e não pode perder a
 * tabela de vista.
 *
 * Três regras de honestidade governam esta tela:
 *
 *   1. Ausência é `—`, nunca zero.
 *   2. Todo dado inferido mostra **de onde veio**, não a porcentagem.
 *   3. Dado de terceiro mostra **a data da fonte**. O provedor é banco de
 *      dados, com mediana de 88 dias na amostra — apresentar um telefone de
 *      2024 sem data é uma afirmação falsa sobre hoje.
 */
export function ProspectDetailSheet({
  campaignId,
  row,
  onOpenChange,
}: {
  campaignId: string
  row: ProspectRow | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)

  if (!row) return null
  const { identity } = row

  function pedirDono() {
    if (!row) return
    setAviso(null)
    startTransition(async () => {
      const r = await requestPersonLookup(campaignId, row.id)
      if (r.status === "error") setAviso(r.message)
      else router.refresh()
    })
  }

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="truncate">{row.title}</SheetTitle>
          <SheetDescription>
            {row.category ?? "Sem categoria"}
            {row.city ? ` · ${row.city}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          <Secao titulo="No Google">
            <Linha rotulo="Endereço" valor={row.address} />
            <Linha
              rotulo="Telefone"
              valor={row.phone ? formatPhone(row.phone) : null}
            />
            <Linha
              rotulo="Site"
              valor={
                row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    {row.domain}
                    <RiExternalLinkLine aria-hidden className="size-3" />
                  </a>
                ) : null
              }
            />
            <Linha
              rotulo="Perfil"
              valor={
                row.isClaimed === null ? null : row.isClaimed ? (
                  "Reivindicado"
                ) : (
                  <Badge variant="secondary">Não reivindicado</Badge>
                )
              }
            />
            <Linha
              rotulo="Avaliações"
              valor={
                row.rating === null
                  ? null
                  : `${row.rating.toFixed(1)} · ${row.votesCount ?? 0} avaliações`
              }
            />
            <Linha
              rotulo="Dado de"
              valor={
                row.listingUpdatedAt
                  ? DATA.format(new Date(row.listingUpdatedAt))
                  : null
              }
            />
          </Secao>

          <Separator />

          <Secao titulo="Identidade">
            {row.taxId && row.taxIdBand !== "none" ? (
              <>
                <Linha
                  rotulo="CNPJ"
                  valor={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">{formatCnpj(row.taxId)}</span>
                      <Badge
                        variant={
                          row.taxIdBand === "confirmed" ? "default" : "secondary"
                        }
                      >
                        {CONFIDENCE_BAND_LABEL[row.taxIdBand]}
                      </Badge>
                    </span>
                  }
                />
                {row.taxIdReason ? (
                  <Linha rotulo="Por quê" valor={row.taxIdReason} />
                ) : null}
                <Linha rotulo="Razão social" valor={identity?.legalName} />
                <Linha
                  rotulo="Capital social"
                  valor={
                    identity?.shareCapital === null ||
                    identity?.shareCapital === undefined
                      ? null
                      : BRL.format(identity.shareCapital)
                  }
                />
                <Linha rotulo="Porte" valor={identity?.size} />
                <Linha
                  rotulo="Atividade"
                  valor={
                    identity?.mainActivity
                      ? `${identity.mainActivity.code} — ${identity.mainActivity.text}`
                      : null
                  }
                />
                <Linha rotulo="Situação" valor={identity?.registrationStatus} />
                <Linha
                  rotulo="Aberta em"
                  valor={
                    identity?.openedAt
                      ? DATA.format(new Date(identity.openedAt))
                      : null
                  }
                />
              </>
            ) : (
              <p className="text-muted-foreground text-xs/relaxed">
                CNPJ não localizado.
                {row.candidates.length > 0
                  ? " Há candidatos abaixo do limiar — o match foi ambíguo."
                  : ""}
              </p>
            )}
          </Secao>

          {row.candidates.length > 0 ? (
            <Secao titulo="Candidatos a CNPJ">
              <ul className="flex flex-col gap-1.5">
                {row.candidates.map((c) => (
                  <li
                    key={c.taxId}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="tabular-nums">{formatCnpj(c.taxId)}</span>
                    <span className="text-muted-foreground truncate">
                      {c.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </Secao>
          ) : null}

          {identity && identity.partners.length > 0 ? (
            <>
              <Separator />
              <Secao titulo="Quadro societário">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sócio</TableHead>
                      <TableHead>Qualificação</TableHead>
                      <TableHead className="text-right">Desde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {identity.partners.map((p) => (
                      <TableRow key={`${p.name}-${p.maskedTaxId ?? ""}`}>
                        <TableCell>
                          <span className="block truncate">{p.name}</span>
                          {/* O CPF fica mascarado, como a Receita publica.
                              Não há caminho de desmascaramento neste produto. */}
                          {p.maskedTaxId ? (
                            <span className="text-muted-foreground block text-xs tabular-nums">
                              {p.maskedTaxId}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.qualification ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {p.since ? DATA.format(new Date(p.since)) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Secao>
            </>
          ) : null}

          <Separator />

          <Secao titulo="Contatos encontrados">
            {row.contacts.length === 0 ? (
              <p className="text-muted-foreground text-xs/relaxed">
                Nenhum canal além do que veio do Google.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {row.contacts.map((c) => (
                  <li key={`${c.kind}-${c.key}`} className="flex flex-col">
                    <span className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{c.kind}</Badge>
                      <span className="truncate">
                        {c.kind === "phone" || c.kind === "whatsapp"
                          ? formatPhone(c.key)
                          : c.value}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {FONTE[c.source] ?? c.source} · confiança {c.confidence}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Separator />

          <Secao titulo="O dono">
            <p className="text-muted-foreground text-xs/relaxed">
              Procura os perfis públicos do sócio administrador. Custa uma busca
              por empresa, trata dado de pessoa física e fica registrado em seu
              nome — por isso é sempre sob pedido.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={pedirDono}
              disabled={pending || !identity || identity.partners.length === 0}
            >
              {pending ? <Spinner aria-hidden /> : <RiUserSearchLine aria-hidden />}
              Buscar o dono
            </Button>
            {aviso ? (
              <p role="alert" className="text-destructive text-xs/relaxed">
                {aviso}
              </p>
            ) : null}
          </Secao>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const FONTE: Record<string, string> = {
  listing: "Google",
  site: "site da empresa",
  public_cnpj_api: "Receita Federal",
  serp: "busca",
  receita: "Receita Federal",
}

function Secao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs/relaxed font-semibold">{titulo}</h3>
      {children}
    </section>
  )
}

function Linha({
  rotulo,
  valor,
}: {
  rotulo: string
  valor: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-2 text-xs/relaxed">
      <dt className="text-muted-foreground">{rotulo}</dt>
      {/* Ausência é um travessão, nunca zero nem string vazia. */}
      <dd className="min-w-0 break-words">{valor || "—"}</dd>
    </div>
  )
}
