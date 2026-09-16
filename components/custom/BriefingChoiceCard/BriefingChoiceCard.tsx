"use client"

import { useId } from "react"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "cn"
import type { BriefingChoiceCardProps } from "./BriefingChoiceCard.types"

/**
 * Cartão de escolha do briefing: rádio à esquerda, título e descrição à direita.
 *
 * **O card é o rótulo, e o `RadioGroupItem` é o rádio.** A versão anterior usava
 * o `RadioGroupItem` como contêiner e mandava o conteúdo para dentro dele — mas
 * o `components/ui/radio-group.tsx` declara o `Indicator` como filho JSX
 * explícito, e filho explícito vence o `children` que chega pelo spread. O
 * conteúdo era descartado e sobrava uma caixa vazia do tamanho de um card.
 *
 * O arranjo de agora é o mesmo que `BriefingFormControls` e as demais etapas do
 * briefing já usam: rádio com `id`, rótulo com `htmlFor`. Clicar em qualquer
 * ponto do card seleciona, como antes.
 */
export function BriefingChoiceCard({
  value,
  title,
  description,
  disabled,
  id,
  className,
}: BriefingChoiceCardProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-left shadow-xs",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        "hover:border-primary/40",
        // O anel de foco fica no card, não no rádio — é onde ele estava antes.
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        "has-data-checked:border-primary has-data-checked:bg-primary/10 has-data-checked:shadow-none",
        "has-data-disabled:pointer-events-none has-data-disabled:opacity-50",
        "cursor-pointer",
        className,
      )}
    >
      {/*
        O rádio de verdade, no lugar do círculo que o card desenhava à mão. As
        duas formas são idênticas — `size-4`, borda `input`, ponto interno
        `size-2` em `primary-foreground` — porque a versão desenhada era cópia
        desta. O anel de foco próprio sai: quem o mostra é o card.
      */}
      <RadioGroupItem
        id={inputId}
        value={value}
        disabled={disabled}
        className="mt-0.5 focus-visible:border-input focus-visible:ring-0 data-checked:focus-visible:border-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs/relaxed font-medium text-foreground">
          {title}
        </span>
        {description ? (
          <span className="mt-1 line-clamp-3 block text-xs/relaxed leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}
