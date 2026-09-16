"use client"

import { RiArrowRightSLine } from "react-icons/ri"
import { ClientPortalCodeReveal } from "@/components/custom/ClientPortalCodeReveal"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClientPortalMenuItems } from "./ClientPortalMenuItems"
import { useClientPortalActions } from "./use-client-portal-actions"
import type { ClientCardMenuProps } from "./ClientCardMenu.types"

/**
 * A linha do card com as duas formas de abrir o mesmo menu.
 *
 * **Dois primitives, de propósito.** A primeira tentativa forçou o
 * `DropdownMenu` a abrir por clique direito, controlando o `open` de fora — e
 * não abria nada: `Menu` não tem noção de origem no ponteiro, e o Base UI
 * publica um `ContextMenu` separado justamente porque abrir no cursor exige
 * gatilho e descarte próprios.
 *
 * O corpo do menu continua sendo um só: `ContextMenu.Item` e `Menu.Item` são o
 * mesmo componente, então `ClientPortalMenuItems` serve os dois. E as duas
 * raízes compartilham **uma** instância das ações, então abrir por um caminho
 * ou por outro carrega o portal uma vez e mostra o mesmo estado.
 */
export function ClientCardMenu({
  clientId,
  snapshot,
  className,
  children,
}: ClientCardMenuProps) {
  const actions = useClientPortalActions(clientId, snapshot)

  return (
    <>
      <ContextMenu onOpenChange={actions.handleOpenChange}>
        {/* O gatilho já rende uma `div` por padrão — conferido no Base UI. */}
        <ContextMenuTrigger className={className}>
          {children}
          <DropdownMenu onOpenChange={actions.handleOpenChange}>
            {/*
              `stopPropagation` fica porque o corpo da linha abre o cliente —
              sem ele, abrir o menu abriria a ficha junto.
            */}
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
              aria-label="Ações do cliente"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {/*
                `size-5` mantém os 20px que a setinha já tinha: o `size` do
                Button governa a altura do controle, e o ícone entraria a 14px
                por padrão — encolhimento que esta mudança não deveria causar.
              */}
              <RiArrowRightSLine
                aria-hidden
                className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <ClientPortalMenuItems actions={actions} />
            </DropdownMenuContent>
          </DropdownMenu>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ClientPortalMenuItems actions={actions} />
        </ContextMenuContent>
      </ContextMenu>

      <ClientPortalCodeReveal
        open={actions.reveal !== null}
        onClose={actions.closeReveal}
        code={actions.reveal?.code ?? ""}
        url={actions.reveal?.url ?? ""}
      />
    </>
  )
}
