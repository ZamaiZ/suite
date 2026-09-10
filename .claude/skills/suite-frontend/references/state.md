# Estado

Sete convenções. Nenhuma é sobre aparência — todas são sobre não perder o que o usuário digitou, ou não mentir sobre o que ele vê. Cada uma está aqui porque a ausência dela já custou um bug neste produto.

## Ajuste de estado ligado a chave vai no render, não em efeito

Quando um estado precisa se re-sincronizar porque o registro mudou — outro perfil, outro canal, outra auditoria — a forma é comparar no corpo do render:

```tsx
const [syncedFrom, setSyncedFrom] = useState(syncKey)
if (syncedFrom !== syncKey) {
  setSyncedFrom(syncKey)
  setValue(initialValue)
}
```

Não é gambiarra: é o padrão que o React documenta para "ajustar estado quando uma prop muda". `useEffect` faz o mesmo trabalho um render depois — e esse render intermediário pinta o valor velho na tela antes de corrigir.

Nomeie os dois de forma que não se confundam. `syncedKey` ao lado de `syncKey` difere por um caractere, e a próxima pessoa "conserta" a comparação achando que ela está errada.

Está em uso em `use-website-controller`, `use-gbp-profile-controller`, `StepNotesField`, `LeadWebsiteReview` e `LeadWebsiteView`.

## Dependência de efeito é chave, nunca objeto

```tsx
useEffect(() => { … }, [audit])      // ✗ reinicia a cada resposta
useEffect(() => { … }, [audit.id])   // ✓
```

Objeto vindo de `props` ganha identidade nova a cada re-render do pai. Num efeito de polling, `[audit]` reinicia o `setInterval` a cada resposta e o ciclo nunca completa. Num efeito que limpa um timer de debounce, `[audit]` descarta o rascunho não salvo a cada resposta do poll.

Se você precisa do objeto inteiro dentro do efeito, leia-o de um `ref` atualizado num efeito sem dependências — não o coloque na lista.

## Esconder não é desmontar

Componente que guarda o valor em `useState(initialValue)` **não pode ser desmontado** enquanto houver rascunho vivo. No remount ele lê de novo o valor do servidor, e o que foi digitado dentro dos 800ms de debounce — ou depois de um erro de salvamento — volta atrás na tela.

Use o atributo `hidden`. Custa um elemento escondido no DOM e resolve na raiz:

```tsx
<StepNotesField hidden={field !== "notes"} … />
<StepNotesField hidden={field !== "finding"} … />
```

O mesmo vale para o colapso de bloco inteiro: fechar esconde, nunca desmonta. E para painel de aba que guarda trabalho em andamento — aí a ferramenta é `keepMounted` no `TabsContent` (ver `components.md`).

## Um debounce por linha do banco

Dois campos que gravam na **mesma linha** pela **mesma action** compartilham um timer só, e o `FormData` leva sempre os dois valores mais recentes:

```tsx
function schedule(next: { review: WebsiteReview; notes: string }) {
  draftRef.current = next
  window.clearTimeout(timerRef.current)
  timerRef.current = window.setTimeout(() => persist(draftRef.current), 800)
}
```

Com um timer por campo, digitar nos dois dentro da janela dispara duas requisições concorrentes para a mesma linha — e a última a chegar sobrescreve o campo que a outra acabou de gravar.

Corolário: **um salvamento é um salvamento.** Exponha um `saveStatus` e um `saveError` só. Dois indicadores de "Salvando…" para uma requisição são mentira na tela.

## Campo ausente não é campo vazio

`formData.get(key)` devolve `null` quando o campo não veio e `""` quando veio vazio. Colapsar os dois em `""` faz um caminho que não manda o campo **apagar** o que estava lá.

```ts
function optionalFormText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}
```

No schema, `undefined` passa (`.optional()`); string vazia vira `null`. Na action, campo ausente **não entra no `upsert`** — no conflito o Postgres só atualiza as colunas enviadas, então omitir preserva. Campo vazio grava `null`, que é o que a maioria dos `check` de comprimento exige (`1..N` ou nulo — string de comprimento zero estoura a constraint).

## Preferência de UI: inicializador preguiçoso e chave por tela

```tsx
const [open, setOpen] = useState(() => {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(KEY) !== "closed"
})
```

`localStorage` e `matchMedia` **nunca** no corpo do render. E a chave é da tela, não do comportamento: `gbp:opportunities-rail` e `website:opportunities-rail` são coisas diferentes, porque a densidade das duas etapas é diferente e quem recolhe numa não quis recolher na outra.

Chaves em uso: `<etapa>:opportunities-rail`, `<etapa>:analyst-block`, `<etapa>:header-numbers`, `gbp:reading-mode`.

## Recolhido recebe `inert`, nunca `aria-hidden`

Conteúdo que continua montado mas saiu de vista — a coluna recolhida, o painel fechado — recebe o atributo booleano `inert`. Ele resolve foco, ponteiro e árvore de acessibilidade de uma vez.

`aria-hidden` sozinho sobre conteúdo que ainda tem elementos focáveis deixa o `Tab` entrar em algo que o leitor de tela não anuncia — que é pior que não ter tratamento nenhum.

## Atalho de teclado desta tela vence o do app

`Ctrl/⌘ + B` e `Ctrl/⌘ + Shift + E` já pertencem ao `Sidebar` e ao `MobileNavigation`, que escutam `window` na fase de **bubble**. Uma tela que quer o mesmo atalho registra em `window` na fase de **captura**, com `preventDefault()` e `stopPropagation()` — a captura roda antes do bubble, então os donos originais não reagem junto. Fechada a tela, nada fica registrado e o atalho volta a ser deles.

Case por `e.code` (código físico), não por `e.key`: é o que os dois handlers do app testam, e casar por `key` faz os três discordarem em layouts de teclado diferentes.

`useCaptureShortcut` em `components/custom/LeadStepShell` já faz tudo isso. `allowInFields` é o que distingue um atalho de "sair daqui" — que precisa funcionar com o cursor dentro do textarea — de um de "abrir aquilo", que não.
