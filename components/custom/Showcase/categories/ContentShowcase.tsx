"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ImageIcon, MoreHorizontalIcon } from "lucide-react"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShowcaseSection } from "../ShowcaseSection"
import { CatalogRoster } from "./CatalogRoster"

const doc = (name: string) => `https://ui.shadcn.com/docs/components/base/${name}`
const chartConfig = { visits: { label: "Visitas", color: "var(--chart-1)" } } satisfies ChartConfig
const chartData = [{ month: "Jan", visits: 120 }, { month: "Fev", visits: 180 }, { month: "Mar", visits: 140 }]

export function ContentShowcase() {
  return <div className="flex flex-col gap-5"><ShowcaseSection title="Aspect Ratio, Avatar e Badge" description="Mídia, identidade e rótulos compactos." documentationHref={doc("avatar")} composition="AspectRatio; Avatar › Fallback; Badge">
    <div className="grid gap-4 sm:grid-cols-3"><AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-md bg-muted"><ImageIcon aria-hidden className="size-8 text-muted-foreground" /></AspectRatio><AvatarGroup><Avatar><AvatarFallback>AZ</AvatarFallback></Avatar><Avatar><AvatarFallback>LM</AvatarFallback></Avatar><AvatarGroupCount>+4</AvatarGroupCount></AvatarGroup><div className="flex flex-wrap content-start gap-2">{(["default", "secondary", "destructive", "outline", "ghost", "link"] as const).map((variant) => <Badge key={variant} variant={variant}>{variant}</Badge>)}</div></div>
  </ShowcaseSection><ShowcaseSection title="Card, Item, Marker e Empty" description="Estruturas para agrupar conteúdo, ações e estados vazios." documentationHref={doc("card")} composition="Card › Header/Content/Footer; Item › Media/Content/Actions">
    <div className="grid gap-4 lg:grid-cols-2"><Card size="sm"><CardHeader><CardTitle>Relatório semanal</CardTitle><CardDescription>Resumo de oportunidades.</CardDescription><CardAction><MoreHorizontalIcon aria-hidden /></CardAction></CardHeader><CardContent>Conteúdo do cartão.</CardContent><CardFooter><Badge variant="secondary">Atualizado</Badge></CardFooter></Card><Item variant="outline"><ItemMedia variant="icon"><ImageIcon /></ItemMedia><ItemContent><ItemTitle>Biblioteca de mídia</ItemTitle><ItemDescription>12 arquivos disponíveis.</ItemDescription></ItemContent><ItemActions><Badge>12</Badge></ItemActions></Item></div><Marker className="mt-4" variant="separator"><MarkerIcon>•</MarkerIcon><MarkerContent>Divisor semântico</MarkerContent></Marker><Empty className="mt-4 min-h-44"><EmptyHeader><EmptyMedia variant="icon"><ImageIcon /></EmptyMedia><EmptyTitle>Nenhum resultado</EmptyTitle><EmptyDescription>Ajuste os filtros para encontrar itens.</EmptyDescription></EmptyHeader></Empty>
  </ShowcaseSection><ShowcaseSection title="Chart e Table" description="Dados mockados com tooltip, legenda textual e tabela responsiva." documentationHref={doc("chart")} composition="ChartContainer › Recharts; Table › Header/Body">
    <div className="grid gap-5 lg:grid-cols-2"><ChartContainer config={chartConfig} className="min-h-48 w-full"><BarChart data={chartData}><CartesianGrid vertical={false} /><XAxis dataKey="month" /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="visits" fill="var(--color-visits)" radius={4} /></BarChart></ChartContainer><Table><TableCaption>Dados locais para a demonstração.</TableCaption><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Visitas</TableHead></TableRow></TableHeader><TableBody>{chartData.map((row) => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell className="text-right">{row.visits}</TableCell></TableRow>)}</TableBody></Table></div>
  </ShowcaseSection><ShowcaseSection title="Carousel, Resizable, Scroll Area, Separator, Skeleton e Data Table" description="Módulos disponíveis para previews estruturados e dados avançados." documentationHref={doc("data-table")} composition="Data Table é Table + TanStack Table, não um módulo-base."><div className="mb-4 flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-40" /></div><CatalogRoster names={["Carousel", "Resizable", "Scroll Area", "Separator", "Data Table (composição TanStack)"]} /></ShowcaseSection></div>
}
