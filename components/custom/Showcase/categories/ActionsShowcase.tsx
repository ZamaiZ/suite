"use client"

import { useState } from "react"
import { RiAddLine, RiCheckLine, RiDeleteBinLine, RiLoader4Line } from "react-icons/ri"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@/components/ui/button-group"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ShowcaseSection } from "../ShowcaseSection"

const doc = (name: string) => `https://ui.shadcn.com/docs/components/base/${name}`

export function ActionsShowcase() {
  const [progress, setProgress] = useState(56)
  return <div className="flex flex-col gap-5">
    <ShowcaseSection title="Button" description="Variações, tamanhos, ícones e estados de ação." documentationHref={doc("button")} composition="Button" notes="Botões somente com ícone recebem aria-label; estado disabled não recebe interação.">
      <div className="flex flex-wrap items-center gap-2">
        {(["default", "outline", "secondary", "ghost", "destructive", "link"] as const).map((variant) => <Button key={variant} variant={variant}>{variant}</Button>)}
        <Button size="icon" aria-label="Adicionar"><RiAddLine aria-hidden /></Button>
        <Button disabled><RiLoader4Line aria-hidden className="animate-spin" />Carregando</Button>
        <Button aria-invalid><RiDeleteBinLine aria-hidden />Inválido</Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">{(["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"] as const).map((size) => <Button key={size} size={size} aria-label={size.startsWith("icon") ? size : undefined}>{size.startsWith("icon") ? <RiAddLine aria-hidden /> : size}</Button>)}</div>
    </ShowcaseSection>
    <ShowcaseSection title="Button Group" description="Agrupa ações relacionadas sem perder foco individual." documentationHref={doc("button-group")} composition="ButtonGroup › Button, ButtonGroupSeparator, ButtonGroupText">
      <ButtonGroup><Button variant="outline">Anterior</Button><ButtonGroupSeparator /><ButtonGroupText>3 de 8</ButtonGroupText><Button variant="outline">Próximo</Button></ButtonGroup>
    </ShowcaseSection>
    <ShowcaseSection title="Alert e Alert Dialog" description="Feedback persistente e confirmação antes de uma ação destrutiva." documentationHref={doc("alert-dialog")} composition="Alert › título/descrição/ação; AlertDialog › trigger › content">
      <div className="grid gap-3 lg:grid-cols-2"><Alert><AlertTitle>Alterações salvas</AlertTitle><AlertDescription>O rascunho está disponível para a equipe.</AlertDescription><AlertAction><Button size="sm" variant="ghost">Desfazer</Button></AlertAction></Alert><Alert variant="destructive"><AlertTitle>Atenção necessária</AlertTitle><AlertDescription>Revise os campos marcados antes de continuar.</AlertDescription></Alert></div>
      <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" className="mt-4" />}><RiDeleteBinLine aria-hidden />Excluir demonstração</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir demonstração?</AlertDialogTitle><AlertDialogDescription>Esta é apenas uma confirmação local do showcase.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </ShowcaseSection>
    <ShowcaseSection title="Progress e Spinner" description="Feedback de progresso determinado e indeterminado." documentationHref={doc("progress")} composition="Progress › label/value/track/indicator">
      <div className="max-w-md"><Progress value={progress}><ProgressLabel>Importando contatos</ProgressLabel><ProgressValue /></Progress><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => setProgress((value) => Math.max(0, value - 10))}>-10%</Button><Button size="sm" onClick={() => setProgress((value) => Math.min(100, value + 10))}>+10%</Button><Spinner /><span className="text-body-sm text-muted-foreground">Processando</span></div></div>
    </ShowcaseSection>
    <ShowcaseSection title="Toggle e Toggle Group" description="Ações pressionáveis independentes e escolhas exclusivas ou múltiplas." documentationHref={doc("toggle-group")} composition="Toggle; ToggleGroup › ToggleGroupItem">
      <div className="flex flex-wrap gap-4"><Toggle aria-label="Favoritar"><RiCheckLine aria-hidden />Favorito</Toggle><Toggle disabled>Desabilitado</Toggle><ToggleGroup defaultValue="center" type="single" variant="outline"><ToggleGroupItem value="left">Esquerda</ToggleGroupItem><ToggleGroupItem value="center">Centro</ToggleGroupItem><ToggleGroupItem value="right">Direita</ToggleGroupItem></ToggleGroup><ToggleGroup type="multiple" variant="outline"><ToggleGroupItem value="bold">Negrito</ToggleGroupItem><ToggleGroupItem value="italic">Itálico</ToggleGroupItem></ToggleGroup></div>
    </ShowcaseSection>
    <ShowcaseSection title="Toast" description="Mensagem temporária com tipos, ação e fechamento." documentationHref={doc("toast")} composition="toast.add › Toaster">
      <div className="flex flex-wrap gap-2">{(["success", "info", "warning", "error", "loading"] as const).map((type) => <Button key={type} variant="outline" onClick={() => toast.add({ title: `Toast ${type}`, description: "Uma mensagem temporária do showcase.", type, actionProps: { children: "Desfazer" } })}>{type}</Button>)}<Button onClick={() => toast.promise(new Promise((resolve) => window.setTimeout(resolve, 700)), { loading: "Salvando", success: "Salvo", error: "Falhou" })}>Promise</Button></div>
    </ShowcaseSection>
  </div>
}
