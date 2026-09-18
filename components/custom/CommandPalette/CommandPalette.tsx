"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCornerDownLeftLine,
} from "react-icons/ri"
import { cn } from "cn"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { useCaptureShortcut } from "@/hooks/use-capture-shortcut"
import { isHrefActive, NAV_ITEMS } from "@/components/custom/navigation"
import type { NavLeaf } from "@/components/custom/navigation.types"
import {
  closeCommandPalette,
  setCommandPaletteOpen,
  startCommandPaletteNavigation,
  toggleCommandPalette,
  useCommandPaletteState,
} from "./command-palette-store"
import type { PaletteRow, PaletteSection } from "./CommandPalette.types"

function toRow(leaf: NavLeaf, groupLabel?: string): PaletteRow {
  return {
    leaf,
    // A descrição não aparece na linha — ela existe aqui para "fila" achar
    // Leads e "papéis" achar Equipe sem custar altura na lista.
    keywords: [leaf.label, leaf.description, groupLabel, leaf.href].filter(
      (value): value is string => Boolean(value),
    ),
  }
}

/**
 * `NAV_ITEMS` é estático, então as seções são montadas uma vez no módulo.
 *
 * Folha de topo vai num grupo sem heading em vez de solta na lista: o
 * `CommandGroup` do registry tem `p-1` próprio, e item solto ao lado de item
 * agrupado desalinha a coluna de ícones em 4px.
 *
 * `hiddenInPalette` é a única coisa que a paleta lê de diferente da sidebar —
 * quem decide o que some é a folha em `navigation.ts`, não uma lista de ids
 * aqui dentro. Grupo que fica sem nenhuma folha visível não vira seção vazia.
 */
function buildSections(): PaletteSection[] {
  const loose: PaletteRow[] = []
  const groups: PaletteSection[] = []

  for (const item of NAV_ITEMS) {
    if (item.kind === "leaf") {
      if (!item.hiddenInPalette) loose.push(toRow(item))
      continue
    }

    const rows = item.children
      .filter((child) => !child.hiddenInPalette)
      .map((child) => toRow(child, item.label))
    if (rows.length === 0) continue

    groups.push({ id: item.id, heading: item.label, rows })
  }

  if (loose.length === 0) return groups
  return [{ id: "geral", rows: loose }, ...groups]
}

const SECTIONS = buildSections()

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * O `command-score`, filtro padrão do `cmdk`, não normaliza diacrítico — e
 * aqui se digita "configuracao". Este casa todos os termos sobre as `keywords`
 * da linha e reserva nota cheia para quando o rótulo **começa** pelo primeiro
 * termo, para "Clientes" vencer "Leads" numa busca por "cli".
 */
function filterRows(value: string, search: string, keywords?: string[]) {
  const terms = normalize(search).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 1

  const fields = (keywords ?? [value]).map(normalize)
  const haystack = fields.join(" ")
  if (!terms.every((term) => haystack.includes(term))) return 0

  return fields[0]?.startsWith(terms[0]) ? 1 : 0.6
}

function PaletteItem({
  row,
  pathname,
  pending,
  onChoose,
}: {
  row: PaletteRow
  pathname: string
  pending: boolean
  onChoose: (leaf: NavLeaf) => void
}) {
  const { leaf, keywords } = row
  const Icon = leaf.icon
  const isActive = !leaf.disabled && isHrefActive(pathname, leaf.href)

  return (
    <CommandItem
      value={leaf.href}
      keywords={keywords}
      disabled={leaf.disabled}
      // O check que o `CommandItem` do registry já carrega vira a marca de
      // página atual, sem markup novo. O cursor do teclado continua sendo o
      // `data-selected`, que pinta a superfície — os dois não se confundem.
      data-checked={isActive ? "true" : undefined}
      aria-current={isActive ? "page" : undefined}
      onSelect={() => onChoose(leaf)}
      className={cn("gap-2.5", isActive && "font-semibold text-foreground")}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary"
        />
      )}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
          isActive
            ? "bg-primary/10 text-primary"
            : "bg-accent text-muted-foreground",
        )}
      >
        {pending ? (
          <Spinner aria-hidden className="size-3.5" />
        ) : Icon ? (
          // `className`, não `size={16}`: o `CommandItem` traz
          // `[&_svg:not([class*='size-'])]:size-3.5`, que venceria o atributo
          // do `react-icons` e encolheria o ícone dentro do poço.
          <Icon aria-hidden className="size-4" />
        ) : null}
      </span>
      <span className="min-w-0 truncate">{leaf.label}</span>
    </CommandItem>
  )
}

function FooterHint({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {label}
    </span>
  )
}

export function CommandPalette() {
  const { open, pendingHref } = useCommandPaletteState()
  const pathname = usePathname()
  const router = useRouter()
  const [highlighted, setHighlighted] = useState("")
  // O `cmdk` não entrega o evento ao `onSelect`, então o modificador precisa
  // ser lembrado um passo antes. Um ref cobre teclado e ponteiro pelo mesmo
  // caminho, sem `preventDefault` disputando com o handler de teclas dele.
  const newTabRef = useRef(false)

  useCaptureShortcut({
    enabled: true,
    code: "KeyK",
    // `Ctrl+K` com o cursor dentro de um campo de busca precisa abrir a paleta.
    allowInFields: true,
    onMatch: toggleCommandPalette,
  })

  // Fecha quando a rota chega. Efeito, e não sync no render: o frame extra com
  // o spinner ainda na tela é justamente o que se quer enquanto a página vem.
  useEffect(() => {
    closeCommandPalette()
  }, [pathname])

  const handleOpenChange = useCallback((next: boolean) => {
    newTabRef.current = false
    setCommandPaletteOpen(next)
  }, [])

  const handleHighlight = useCallback(
    (value: string) => {
      setHighlighted(value)
      if (value.startsWith("/")) router.prefetch(value)
    },
    [router],
  )

  const handleChoose = useCallback(
    (leaf: NavLeaf) => {
      if (leaf.disabled) return

      if (newTabRef.current) {
        newTabRef.current = false
        window.open(leaf.href, "_blank", "noopener,noreferrer")
        closeCommandPalette()
        return
      }

      // Sem a guarda, escolher a página em que já se está prenderia a paleta:
      // o `pathname` não muda e o efeito que fecha nunca roda.
      if (isHrefActive(pathname, leaf.href)) {
        closeCommandPalette()
        return
      }

      startCommandPaletteNavigation(leaf.href)
      router.push(leaf.href)
    },
    [pathname, router],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Navegação rápida"
      description="Busque uma página e pressione Enter para abrir."
      className="max-w-lg gap-0 shadow-lg"
    >
      <Command
        loop
        filter={filterRows}
        value={highlighted}
        onValueChange={handleHighlight}
        onKeyDownCapture={(event) => {
          if (event.key !== "Enter") return
          newTabRef.current = event.ctrlKey || event.metaKey
        }}
        onPointerDownCapture={(event) => {
          newTabRef.current = event.ctrlKey || event.metaKey
        }}
      >
        <CommandInput placeholder="Buscar página" />
        <CommandList className="max-h-[min(22rem,48vh)]">
          <CommandEmpty>
            Nenhuma página com esse nome. Apague a busca para ver todas.
          </CommandEmpty>
          {SECTIONS.map((section) => (
            <CommandGroup
              key={section.id}
              value={section.id}
              heading={section.heading}
              className="pt-1.5"
            >
              {section.rows.map((row) => (
                <PaletteItem
                  key={row.leaf.href}
                  row={row}
                  pathname={pathname}
                  pending={pendingHref === row.leaf.href}
                  onChoose={handleChoose}
                />
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/70 px-3 py-2 text-[0.625rem] text-muted-foreground">
        <FooterHint label="navegar">
          <KbdGroup>
            <Kbd>
              <RiArrowUpLine aria-hidden />
            </Kbd>
            <Kbd>
              <RiArrowDownLine aria-hidden />
            </Kbd>
          </KbdGroup>
        </FooterHint>
        <FooterHint label="abrir">
          <Kbd>
            <RiCornerDownLeftLine aria-hidden />
          </Kbd>
        </FooterHint>
        <FooterHint label="nova aba">
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>
              <RiCornerDownLeftLine aria-hidden />
            </Kbd>
          </KbdGroup>
        </FooterHint>
        <FooterHint label="fechar">
          <Kbd>Esc</Kbd>
        </FooterHint>
      </div>
    </CommandDialog>
  )
}
