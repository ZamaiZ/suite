# Escrita de interface

Palavra em tela é conteúdo de design, não enfeite. Mesma disciplina que você aplica a espaço e cor.

## Nomeie pelo que o usuário entende

O nome do campo no banco não é o nome na tela.

| Não | Sim |
|---|---|
| "GBP profile" | "Perfil do Google" |
| "referral_source" | "Quem indicou" |
| "Configurar webhook" | "Receber avisos de novos leads" |

O vocabulário da interface é a sinalização de quem está aprendendo a se virar no produto. Um conceito tem um nome só, da lista ao detalhe ao relatório.

## O CTA diz o que acontece

"Salvar alterações", não "Enviar". "Finalizar briefing", não "Concluir".

O verbo do botão é o verbo do resultado: `Publicar` → toast `Publicado`. Trocar de palavra no meio do caminho faz o usuário procurar o que ele acabou de fazer.

## O erro diz o que houve e como sair

Não pede desculpa, não é vago, não fala na primeira pessoa.

| Não | Sim |
|---|---|
| "Ocorreu um erro ao processar sua solicitação." | "Não foi possível coletar o perfil: o Google não respondeu. Tente de novo em alguns minutos." |
| "Campo inválido." | "Observação deve ter no máximo 2000 caracteres." |
| "Desculpe, algo deu errado ao buscar o endereço." | "Não foi possível localizar o endereço. Confira o CEP ou busque pelo nome da rua." |

Erro em campo mora no `FieldError`, ligado por `aria-describedby` — não num toast que some antes de ser lido.

## Vazio é convite

Estado vazio é a primeira tela de quem está começando. Ela pede uma ação.

| Não | Sim |
|---|---|
| "Sem dados" | "Nenhum lead ainda. Importe uma planilha ou crie o primeiro." |
| "Nenhum resultado" | "Nenhum lead com esses filtros. Limpe os filtros para ver todos." |

Vazio por falta de dado e vazio por filtro são telas diferentes — a segunda oferece limpar o filtro.

E existe um terceiro, em tela de auditoria: **campo que não existia na versão da coleta**. "Origem dos links entra na próxima análise — esta coleta é anterior a esse campo" não é a mesma frase que "nenhum link encontrado". Um diz que o provedor não trouxe; o outro afirma sobre o mundo.

## Ausência é `—`, nunca zero

Um domínio sem coleta não é um domínio sem autoridade. Um perfil sem medição não tem nota 0. Quando o valor não foi medido, a tela escreve `—` e o complemento diz por quê (`sem coleta`, `sem dado de campo`, `não medido`) — nunca um número que o leitor vai somar, comparar e levar para a reunião.

A regra vale nos três lugares onde a confusão custa caro: big number, célula de métrica e barra. Barra sem denominador conhecido **não é renderizada**; ver `layout.md`.

| Não | Sim |
|---|---|
| `0` domínios de referência (sem coleta) | `—` · `sem coleta` |
| `0%` de dofollow (provider não devolveu) | `—` · `sem dado` |
| `Nenhum sinal de rede artificial` (amostra truncada) | `A amostra bateu no teto e não cobre o perfil inteiro; sobre o resto, nada foi verificado.` |

A última linha é a mais difícil e a mais importante: **silêncio sobre o que ficou de fora não é afirmação de que não há nada lá.**

## Sentence case

Só a primeira letra e nomes próprios. Vale para botão, rótulo, título de diálogo, item de menu e aba.

"Editar contato", não "Editar Contato". "Data e horário", não "Data e Horário".

## Sem filler

"Aqui você pode gerenciar seus leads" não sobrevive ao corte — o título já disse. Descrição existe para acrescentar o que o título não coube, ou não existe.

Rótulo de campo não repete o que o placeholder já mostra. Se o campo se chama "Ticket médio", o placeholder é um exemplo (`Ex.: R$ 2.500`), não "Digite o ticket médio".

## Tom

Direto, adulto, sem entusiasmo fabricado. Nada de exclamação, nada de emoji, nada de "Ops". A interface é uma ferramenta de trabalho para quem usa o produto o dia inteiro — ela informa e sai da frente.
