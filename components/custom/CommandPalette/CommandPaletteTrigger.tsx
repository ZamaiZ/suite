"use client"

import { RiSearchLine } from "react-icons/ri"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { openCommandPalette } from "./command-palette-store"
import type { CommandPaletteTriggerProps } from "./CommandPalette.types"

/**
 * Porta de entrada visível da paleta.
 *
 * `variant="outline"` já é quase o `bg-input/…` do `CommandInput`; o `bg-input/20`
 * fecha a diferença no tema claro, para o gatilho e a camada que ele abre
 * lerem como o mesmo objeto.
 *
 * `h-10` acompanha a linha do `NavTree` logo abaixo, como o botão de sair já
 * faz no rodapé — a escala de `size` do registry para em `lg` (h-8) e uma
 * altura menor quebraria o ritmo da coluna.
 */
export function CommandPaletteTrigger({
  collapsed = false,
  className,
}: CommandPaletteTriggerProps) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="block w-full" />}>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Buscar página"
            onClick={openCommandPalette}
            className={cn(
              "h-10 w-full bg-input/20 text-muted-foreground",
              className,
            )}
          >
            <RiSearchLine aria-hidden className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          Buscar página
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={openCommandPalette}
      className={cn(
        "h-10 w-full justify-start gap-2.5 bg-input/20 px-3 text-muted-foreground",
        className,
      )}
    >
      <RiSearchLine aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 truncate">Buscar página</span>
      <KbdGroup className="ml-auto">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
  )
}
