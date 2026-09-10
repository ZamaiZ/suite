# Verificação

Rode antes de dizer que terminou. Compare com o baseline: o que interessa não é a contagem absoluta, é ela ter subido.

## Ambiente

Git Bash no Windows. Duas armadilhas:

- **`grep -P` não funciona** — `grep: -P supports only unibyte and UTF-8 locales`. Para excluir um padrão, use `grep -E` seguido de `grep -v`.
- **`bc` não existe.** Contagem é `wc -l`.

`components/ui` fica **fora** do escopo dos checks: é código gerado pelo registry, e policiá-lo produz falso positivo. `oklch(from var(--token) …)` é cor relativa derivada de token — legítima, e por isso excluída do check de cor.

## Greps de reprovação

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"

echo -n "cor cravada:        "; grep -rnE "oklch\(|#[0-9a-fA-F]{3,8}|rgba?\(" --include=*.tsx components/custom app | grep -v "oklch(from " | wc -l
echo -n "z-[N] avulso:       "; grep -rnE "z-\[" --include=*.tsx components/custom app | wc -l
echo -n "lucide:             "; grep -rn "lucide-react" --include=*.tsx --include=*.ts components app lib hooks | wc -l
echo -n "cn errado:          "; grep -rn 'cn.*from "@/lib/utils"' --include=*.tsx components app | wc -l
echo -n "motion.* em vez m.: "; grep -rnE "<motion\." --include=*.tsx components app | wc -l
echo -n "base-ui direto:     "; grep -rn "@base-ui/react" --include=*.tsx components/custom app | wc -l
echo -n "altura mágica:      "; grep -rnoE "<(Button|Input|Textarea|SelectTrigger|Toggle)[^>]*className=\"[^\"]*\bh-[0-9]" --include=*.tsx components/custom app | wc -l
echo -n "anima sem reduced:  "; for f in $(grep -rlE "<m\." --include=*.tsx components/custom app); do grep -q "useReducedMotion" "$f" || echo "$f"; done | wc -l
```

O que cada ocorrência significa:

| Check | Significa |
|---|---|
| cor cravada | valor que não acompanha o dark — troque por token |
| `z-[N]` avulso | empilhamento que não conversa com o `z-50` dos overlays do registry |
| lucide | ícone fora do vocabulário; o app é `react-icons/ri` |
| `cn` errado | `@/lib/utils` só reexporta; importe de `"cn"` |
| `motion.*` | o `LazyMotion strict` reprova — conteúdo fica invisível no DOM |
| base-ui direto | há equivalente em `components/ui`; use o equivalente |
| altura mágica | `h-N` num controle que já tem `size` desalinha a linha inteira |
| anima sem reduced | falta `useReducedMotion` em componente que anima |

## Baseline conhecido

Conferido em 2026-09-10. Existem hoje e são débito conhecido, não regressão.

| Check | Hoje | Onde | O que é |
|---|---|---|---|
| cor cravada | 5 | `components/custom/NavTree/NavTree.tsx` | `dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]` repetido — filete branco no escuro que deveria derivar de `--border`, que já é `oklch(1 0 0 / 10%)` |
| base-ui direto | 2 | `DateTimePicker`, `TimePicker` | importam `Popover` de `@base-ui/react` em vez do local; a spec de realinhamento previa a troca e ela não aconteceu |
| anima sem reduced | 1 | `components/custom/LeadGbpPanel/LeadGbpAuditStep.tsx` | único dos 35 arquivos que animam sem `useReducedMotion` |

Todos os outros checks estão em **zero**. Qualquer número acima do baseline é coisa nova.

Corrigir um desses débitos é trabalho próprio, com sua própria aprovação — não carona numa tarefa de UI.

## Piso de acessibilidade

- foco visível em claro **e** escuro, inclusive sobre `card`, sidebar e toolbar
- `aria-label` em todo controle que só tem ícone
- `aria-invalid` e `aria-describedby` em campo com erro — vem de graça no `Field`
- `prefers-reduced-motion` respeitado em tudo que anima
- status nunca só por cor: sempre com texto, ícone ou forma junto
- contraste AA para texto normal e componente interativo
- `DialogTitle` presente mesmo quando invisível (`sr-only`)
- tabela larga rola no próprio contêiner; a página nunca rola na horizontal

## Autocrítica

Antes de entregar, escreva duas linhas: **o que você cortou e por quê.**

Se não cortou nada, você não terminou. Olhe de novo e tire um acessório.
