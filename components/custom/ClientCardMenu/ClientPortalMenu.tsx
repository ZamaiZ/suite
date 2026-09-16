"use client"

import { RiMore2Line } from "react-icons/ri"
import { ClientPortalCodeReveal } from "@/components/custom/ClientPortalCodeReveal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClientPortalMenuItems } from "./ClientPortalMenuItems"
import { useClientPortalActions } from "./use-client-portal-actions"
import type { ClientPortalMenuProps } from "./ClientCardMenu.types"

/**
 * As mesmas ações do card, num botão avulso.
 *
 * Serve o cabeçalho do diálogo do cliente, onde não há linha para clicar com o
 * botão direito nem setinha — então o gatilho volta a ser os três pontinhos.
 * Os itens e a lógica são os mesmos do card.
 */
export function ClientPortalMenu({
  clientId,
  snapshot,
}: ClientPortalMenuProps) {
  const actions = useClientPortalActions(clientId, snapshot)

  return (
    <>
      <DropdownMenu onOpenChange={actions.handleOpenChange}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-lg" />}
          aria-label="Ações do cliente"
          className="shrink-0"
        >
          <RiMore2Line size={18} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <ClientPortalMenuItems actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientPortalCodeReveal
        open={actions.reveal !== null}
        onClose={actions.closeReveal}
        code={actions.reveal?.code ?? ""}
        url={actions.reveal?.url ?? ""}
      />
    </>
  )
}
