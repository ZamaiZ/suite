"use client"

import {
  RiCheckLine,
  RiFileCopyLine,
  RiKey2Line,
  RiRefreshLine,
} from "react-icons/ri"
import { Spinner } from "@/components/ui/spinner"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { ClientPortalActions } from "./use-client-portal-actions"

/**
 * O corpo do menu, uma vez só.
 *
 * `DropdownMenuItem` serve aos dois menus porque `ContextMenu.Item` e
 * `Menu.Item` do Base UI são **o mesmo componente** — conferido. Sem isso, o
 * clique direito e a setinha exigiriam duas listas de itens, e duas listas
 * divergem na primeira alteração.
 */
export function ClientPortalMenuItems({
  actions,
}: {
  actions: ClientPortalActions
}) {
  const { portal } = actions
  return (
    <>
      {actions.loadingDetail && !portal ? (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs/relaxed text-muted-foreground">
          <Spinner aria-hidden className="size-4" />
          Carregando…
        </div>
      ) : null}
      {actions.loadError ? (
        <p
          role="alert"
          className="px-2 py-1.5 text-xs/relaxed text-destructive"
        >
          {actions.loadError}
        </p>
      ) : null}
      {portal && !portal.hasPortalAccess ? (
        <DropdownMenuItem
          disabled={actions.isPending}
          onClick={actions.runIssue}
        >
          <RiKey2Line size={16} aria-hidden />
          {actions.isPending ? "Gerando…" : "Gerar acesso"}
        </DropdownMenuItem>
      ) : null}
      {portal?.hasPortalAccess ? (
        <>
          <DropdownMenuItem
            disabled={actions.isPending || !portal.portalUrl}
            onClick={actions.copyLink}
          >
            {actions.copied ? (
              <RiCheckLine size={16} aria-hidden />
            ) : (
              <RiFileCopyLine size={16} aria-hidden />
            )}
            {actions.copied ? "Link copiado" : "Copiar link"}
          </DropdownMenuItem>
          {actions.confirmRotate ? (
            <DropdownMenuItem
              disabled={actions.isPending}
              onClick={actions.runRotate}
              variant="destructive"
            >
              <RiRefreshLine size={16} aria-hidden />
              {actions.isPending ? "Rotacionando…" : "Confirmar rotação"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              closeOnClick={false}
              disabled={actions.isPending}
              onClick={actions.askRotate}
            >
              <RiRefreshLine size={16} aria-hidden />
              Rotacionar código
            </DropdownMenuItem>
          )}
        </>
      ) : null}
      {actions.confirmRotate ? (
        <p className="px-2 py-1 text-xs/relaxed text-warning">
          Invalida o código e a sessão atuais.
        </p>
      ) : null}
      {actions.actionError ? (
        <p
          role="alert"
          className="px-2 py-1.5 text-xs/relaxed text-destructive"
        >
          {actions.actionError}
        </p>
      ) : null}
    </>
  )
}
