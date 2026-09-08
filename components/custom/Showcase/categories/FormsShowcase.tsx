"use client"

import { useState } from "react"
import { CalendarIcon, MailIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ShowcaseSection } from "../ShowcaseSection"

const doc = (name: string) => `https://ui.shadcn.com/docs/components/base/${name}`

export function FormsShowcase() {
  const [date, setDate] = useState<Date>()
  const [checked, setChecked] = useState(false)
  return <div className="flex flex-col gap-5">
    <ShowcaseSection title="Field, Label, Input e Textarea" description="Campos com rótulo visível, ajuda, erro e estados nativos." documentationHref={doc("field")} composition="Field › FieldLabel + FieldContent › Input/Textarea" notes="Não use placeholder como rótulo; erros ficam adjacentes ao campo.">
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="showcase-email">E-mail</FieldLabel><FieldContent><Input id="showcase-email" type="email" placeholder="voce@empresa.com" /><FieldDescription>Usado somente neste preview.</FieldDescription></FieldContent></Field><Field data-invalid="true"><FieldLabel htmlFor="showcase-invalid">Nome obrigatório</FieldLabel><FieldContent><Input id="showcase-invalid" aria-invalid placeholder="Nome" /><FieldError>Informe um nome para continuar.</FieldError></FieldContent></Field><Field className="sm:col-span-2"><FieldLabel htmlFor="showcase-note">Observação</FieldLabel><Textarea id="showcase-note" placeholder="Escreva uma observação…" /></Field></div>
    </ShowcaseSection>
    <ShowcaseSection title="Input Group" description="Entrada com ícone e addon sem perder o foco do controle." documentationHref={doc("input-group")} composition="InputGroup › InputGroupAddon + InputGroupInput">
      <InputGroup className="max-w-md"><InputGroupAddon><SearchIcon aria-hidden /></InputGroupAddon><InputGroupInput placeholder="Buscar componentes" /><InputGroupAddon align="inline-end"><MailIcon aria-hidden /></InputGroupAddon></InputGroup>
    </ShowcaseSection>
    <ShowcaseSection title="Checkbox, Radio, Switch e Slider" description="Controles de seleção, todos com estados controlados locais." documentationHref={doc("checkbox")} composition="Label + control">
      <div className="grid gap-5 sm:grid-cols-2"><Label className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />Receber atualizações</Label><RadioGroup defaultValue="monthly" className="flex gap-3"><Label className="flex items-center gap-2"><RadioGroupItem value="monthly" />Mensal</Label><Label className="flex items-center gap-2"><RadioGroupItem value="yearly" />Anual</Label></RadioGroup><Label className="flex items-center gap-2"><Switch />Modo compacto</Label><div><Label htmlFor="showcase-slider">Intensidade</Label><Slider id="showcase-slider" className="mt-3" defaultValue={[45]} max={100} step={5} /></div></div>
    </ShowcaseSection>
    <ShowcaseSection title="Select" description="Lista posicionada pelo primitive Base UI." documentationHref={doc("select")} composition="Select › Trigger/Value + Content › Item">
      <Select defaultValue="mira"><SelectTrigger className="w-48"><SelectValue placeholder="Escolha um estilo" /></SelectTrigger><SelectContent><SelectItem value="mira">Mira</SelectItem><SelectItem value="nova">Nova</SelectItem><SelectItem value="vega">Vega</SelectItem></SelectContent></Select>
    </ShowcaseSection>
    <ShowcaseSection title="Calendar e Date Picker" description="Date Picker é composição de Popover, Button e Calendar." documentationHref={doc("date-picker")} composition="Popover › Trigger + Content › Calendar">
      <div className="flex flex-wrap gap-6"><Calendar mode="single" selected={date} onSelect={setDate} disabled={{ before: new Date(2026, 0, 1) }} /><Popover><PopoverTrigger render={<Button variant="outline" />}><CalendarIcon aria-hidden />{date ? date.toLocaleDateString("pt-BR") : "Escolher data"}</PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent></Popover></div>
    </ShowcaseSection>
    <ShowcaseSection title="Input OTP" description="Código segmentado com navegação por teclado." documentationHref={doc("input-otp")} composition="InputOTP › InputOTPGroup › InputOTPSlot">
      <InputOTP maxLength={6}><InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup></InputOTP>
    </ShowcaseSection>
    <ShowcaseSection title="Combobox e Questionnaire" description="Esses módulos exigem dados e fluxo próprios; a cobertura detalhada permanece documentada no catálogo." documentationHref={doc("questionnaire")} composition="Combobox › input/list; Questionnaire › steps/choices/actions" notes="Os componentes são mantidos como módulos disponíveis para composições de busca e etapas, sem dependência externa.">
      <p className="text-body-sm text-muted-foreground">Combobox e Questionnaire são reservados para a etapa interativa de fluxo completo, evitando inventar uma API de dados que não pertence ao produto.</p>
    </ShowcaseSection>
  </div>
}
