"use client"

import {
  RiAddLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiMapPin2Line,
  RiMore2Line,
  RiRefreshLine,
  RiStarLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadGbpStepHeader({
  updatedAt,
  mapsHref,
  collecting,
  canEdit,
  readingMode,
  isPrimary,
  onEnrich,
  onPrimary,
  onRefresh,
  onRemove,
  onAddProfile,
}: {
  updatedAt: string | null
  mapsHref: string | null
  collecting: boolean
  canEdit: boolean
  /** Modo reunião: esconde edição. Nunca habilita nada. */
  readingMode: boolean
  isPrimary: boolean
  onEnrich: () => void
  onPrimary: () => void
  onRefresh: () => void
  onRemove: () => void
  onAddProfile: () => void
}) {
  const showActions = canEdit && !readingMode

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiMapPin2Line} />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Perfil no Google
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Presença, reputação e posicionamento local da empresa.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {updatedAt ? (
          <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
            <RiCheckLine size={14} aria-hidden className="text-success" />
            Atualizado {formatRelativeShort(updatedAt)}
          </span>
        ) : null}
        {showActions ? (
          <Button
            type="button"
            variant="secondary"
            disabled={collecting}
            onClick={onEnrich}
          >
            {collecting ? (
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiRefreshLine data-icon="inline-start" aria-hidden />
            )}
            Atualizar coleta
          </Button>
        ) : null}
        {mapsHref && !readingMode ? (
          <Button
            type="button"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() =>
              window.open(mapsHref, "_blank", "noopener,noreferrer")
            }
          >
            Ver no Google
            <RiExternalLinkLine data-icon="inline-end" aria-hidden />
          </Button>
        ) : null}
        {showActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
              aria-label="Ações do perfil"
            >
              <RiMore2Line size={16} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem disabled={isPrimary} onClick={onPrimary}>
                <RiStarLine size={16} aria-hidden />
                Definir como principal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh}>
                <RiRefreshLine size={16} aria-hidden />
                Atualizar dados do Places
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddProfile}>
                <RiAddLine size={16} aria-hidden />
                Adicionar perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} variant="destructive">
                <RiDeleteBinLine size={16} aria-hidden />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}
