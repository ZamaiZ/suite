"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RiArrowLeftLine, RiCloseLine, RiUserAddLine } from "react-icons/ri"
import { cn } from "cn"

import { dismissProspects, promoteProspectsToLeads } from "@/app/actions/prospect"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"

import { ProspectDetailSheet } from "./ProspectDetailSheet"
import { ProspectRunner } from "./ProspectRunner"
import { ProspectTable } from "./ProspectTable"
import type {
  ProspectRow,
  ProspectWorkspaceProps,
} from "./ProspectWorkspace.types"

const NUM = new Intl.NumberFormat("pt-BR")
const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

/**
 * O painel de trabalho da campanha.
 *
 * Arquétipo do `LeadStepShell`: cabeçalho fixo com os números e o motor, corpo
 * rolável com a tabela, trilho de seleção à direita. O `min-h-0` no filho do
 * grid é obrigatório — sem ele o grid estoura, e o bug só aparece quando a
 * lista fica longa.
 */
export function ProspectWorkspace({ view }: ProspectWorkspaceProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [aberta, setAberta] = useState<ProspectRow | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  const { campaign, prospects, progress, counts } = view
  const ids = [...selected]

  function promover() {
    setConfirmar(false)
    startTransition(async () => {
      const r = await promoteProspectsToLeads(campaign.id, ids)
      if (r.status === "error") {
        setResultado(r.message)
        return
      }
      setResultado(r.message)
      setSelected(new Set())
      router.refresh()
    })
  }

  function descartar() {
    startTransition(async () => {
      const r = await dismissProspects(campaign.id, ids, "Fora do perfil")
      if (r.status === "error") {
        setResultado(r.message)
        return
      }
      setResultado(`${r.dismissed} descartada(s).`)
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href="/prospeccao"
                className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs transition-colors"
              >
                <RiArrowLeftLine aria-hidden className="size-3" />
                Campanhas
              </Link>
              <h1 className="truncate text-lg font-semibold">{campaign.name}</h1>
              <p className="text-muted-foreground text-xs/relaxed">
                {campaign.categories.join(", ")} · {campaign.city}/
                {campaign.state_code} · raio {Number(campaign.radius_km)} km
              </p>
            </div>
            <p className="text-muted-foreground text-xs/relaxed">
              Custo{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {CURRENCY.format(
                  Number(campaign.discovery_cost_usd) +
                    Number(campaign.enrichment_cost_usd),
                )}
              </span>
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BigNumber label="Descobertas" value={counts.total} />
            <BigNumber label="Com CNPJ" value={counts.withTaxId} />
            <BigNumber label="Com contato" value={counts.withContact} />
            <BigNumber label="Promovidas" value={counts.promoted} />
          </dl>

          <ProspectRunner
            campaignId={campaign.id}
            status={campaign.status}
            discovered={campaign.discovered_count}
            target={campaign.target_count}
            universeCount={campaign.universe_count}
            progress={progress}
            selectedIds={ids}
            errorMessage={campaign.error_message}
          />

          {resultado ? (
            <p
              role="status"
              aria-live="polite"
              className="bg-muted/50 rounded-md px-3 py-2 text-xs/relaxed"
            >
              {resultado}
            </p>
          ) : null}
        </header>

        <div className="min-h-0 overflow-y-auto">
          <ProspectTable
            rows={prospects}
            selected={selected}
            onSelectedChange={setSelected}
            onOpen={setAberta}
          />
        </div>
      </div>

      <aside className="flex h-fit flex-col gap-3 rounded-lg border p-3 lg:sticky lg:top-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs/relaxed font-semibold">Seleção</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {NUM.format(selected.size)}
          </span>
        </div>
        {selected.size === 0 ? (
          <p className="text-muted-foreground text-xs/relaxed">
            Marque as empresas que valem o trabalho. Enriquecer e promover
            agem só sobre a seleção.
          </p>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => setConfirmar(true)}
              disabled={pending}
            >
              {pending ? <Spinner aria-hidden /> : <RiUserAddLine aria-hidden />}
              Promover a lead
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={descartar}
              disabled={pending}
            >
              <RiCloseLine aria-hidden />
              Descartar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={pending}
            >
              Limpar seleção
            </Button>
          </>
        )}
        <p className="text-muted-foreground text-xs/relaxed">
          Empresas sem site entram no board com o perfil do Google como canal
          principal.
        </p>
      </aside>

      <ProspectDetailSheet
        campaignId={campaign.id}
        row={aberta}
        onOpenChange={(open) => {
          if (!open) setAberta(null)
        }}
      />

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Promover {NUM.format(selected.size)}{" "}
              {selected.size === 1 ? "empresa" : "empresas"} a lead?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cada uma vira um lead novo na coluna &ldquo;Novo&rdquo; do board,
              sem responsável. Quem já estiver no board é apenas apontado, não
              duplicado. Não dá para desfazer em massa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={promover}>Promover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BigNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn("flex flex-col rounded-lg border px-3 py-2")}>
      <dd className="text-xl font-semibold tabular-nums">
        {value === 0 ? "—" : NUM.format(value)}
      </dd>
      <dt className="text-muted-foreground text-xs">{label}</dt>
    </div>
  )
}
