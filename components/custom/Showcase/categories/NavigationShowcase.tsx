"use client"

import { useState } from "react"
import { RiHomeLine, RiSearchLine } from "react-icons/ri"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShowcaseSection } from "../ShowcaseSection"
import { CatalogRoster } from "./CatalogRoster"

const doc = (name: string) => `https://ui.shadcn.com/docs/components/base/${name}`

export function NavigationShowcase() {
  const [tab, setTab] = useState("overview")
  return <div className="flex flex-col gap-5"><ShowcaseSection title="Breadcrumb e Kbd" description="Localização atual e atalhos legíveis." documentationHref={doc("breadcrumb")} composition="Breadcrumb › List › Item › Link/Page">
    <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#"><RiHomeLine aria-hidden />Início</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink href="#">Showcase</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Ações</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><p className="mt-4 text-body-sm">Abrir busca <Kbd>⌘ K</Kbd></p>
  </ShowcaseSection><ShowcaseSection title="Command" description="Paleta pesquisável, grupos, vazio e atalhos." documentationHref={doc("command")} composition="Command › Input + List › Group › Item">
    <Command className="max-w-lg border border-border"><CommandInput placeholder="Buscar uma ação" /><CommandList><CommandEmpty>Nenhum resultado.</CommandEmpty><CommandGroup heading="Navegação"><CommandItem><RiHomeLine />Início<CommandShortcut>G H</CommandShortcut></CommandItem><CommandItem><RiSearchLine />Buscar<CommandShortcut>⌘ K</CommandShortcut></CommandItem></CommandGroup></CommandList></Command>
  </ShowcaseSection><ShowcaseSection title="Tabs e Pagination" description="Mudança de contexto e navegação entre páginas." documentationHref={doc("tabs")} composition="Tabs › List › Trigger + Content">
    <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="details">Detalhes</TabsTrigger><TabsTrigger value="disabled" disabled>Indisponível</TabsTrigger></TabsList><TabsContent value="overview">Conteúdo da visão geral.</TabsContent><TabsContent value="details">Conteúdo detalhado.</TabsContent></Tabs><Pagination className="mt-4 justify-start"><PaginationContent><PaginationItem><PaginationPrevious href="#" /></PaginationItem><PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem><PaginationItem><PaginationEllipsis /></PaginationItem><PaginationItem><PaginationNext href="#" /></PaginationItem></PaginationContent></Pagination>
  </ShowcaseSection><ShowcaseSection title="Menubar, Navigation Menu e Sidebar" description="Módulos de navegação disponíveis para composições dedicadas." documentationHref={doc("sidebar")} composition="Menus e Sidebar exigem uma área de layout própria."><CatalogRoster names={["Menubar", "Navigation Menu", "Sidebar"]} /></ShowcaseSection></div>
}
