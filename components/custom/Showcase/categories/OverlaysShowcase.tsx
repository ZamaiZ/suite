"use client"

import { useState } from "react"
import { RiArrowDownSLine, RiInformationLine } from "react-icons/ri"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ShowcaseSection } from "../ShowcaseSection"
import { CatalogRoster } from "./CatalogRoster"

const doc = (name: string) =>
  `https://ui.shadcn.com/docs/components/base/${name}`

export function OverlaysShowcase() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-5">
      <ShowcaseSection
        title="Accordion e Collapsible"
        description="Revelação progressiva sem perder semântica de controle."
        documentationHref={doc("accordion")}
        composition="Accordion › Item › Trigger + Content"
      >
        <Accordion className="max-w-xl" defaultValue={["tokens"]}>
          <AccordionItem value="tokens">
            <AccordionTrigger>Tokens shadcn</AccordionTrigger>
            <AccordionContent>
              As demos leem primary, muted, popover, card e ring do tema gerado.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="a11y">
            <AccordionTrigger>Acessibilidade</AccordionTrigger>
            <AccordionContent>
              Foco visível e teclado permanecem no primitive.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Collapsible
          open={open}
          onOpenChange={setOpen}
          className="mt-4 max-w-xl"
        >
          <CollapsibleTrigger render={<Button variant="outline" />}>
            <RiArrowDownSLine aria-hidden />
            {open ? "Recolher" : "Expandir"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-md bg-muted p-3 text-xs/relaxed">
            Conteúdo progressivo.
          </CollapsibleContent>
        </Collapsible>
      </ShowcaseSection>
      <ShowcaseSection
        title="Dialog, Popover e Tooltip"
        description="Camadas com trigger, foco e escape gerenciados pelo Base UI."
        documentationHref={doc("dialog")}
        composition="Trigger › Portal › Content"
      >
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger render={<Button />}>Abrir dialog</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog de demonstração</DialogTitle>
                <DialogDescription>
                  Uma superfície modal com título e descrição.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              Abrir popover
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-xs/relaxed">Conteúdo contextual.</p>
            </PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mais informações"
                />
              }
            >
              <RiInformationLine aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Informações adicionais</TooltipContent>
          </Tooltip>
        </div>
      </ShowcaseSection>
      <ShowcaseSection
        title="Menus, Drawer, Sheet e Hover Card"
        description="Módulos de camada que requerem superfícies interativas específicas."
        documentationHref={doc("drawer")}
        composition="Context Menu, Dropdown Menu, Drawer, Sheet e Hover Card"
      >
        <CatalogRoster
          names={[
            "Context Menu",
            "Dropdown Menu",
            "Drawer",
            "Hover Card",
            "Sheet",
          ]}
        />
      </ShowcaseSection>
    </div>
  )
}
