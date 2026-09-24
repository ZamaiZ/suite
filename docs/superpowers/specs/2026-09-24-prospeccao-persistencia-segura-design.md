# Prospecção: persistência diagnóstica e tolerante a registros inválidos

## Contexto observado

Três execuções da pesquisa `construction_company` em Guarulhos chegaram a
`status = failed` depois de uma chamada paga. O limite autorizado era de 200
resultados. Cada execução registrou US$ 0,084 em
`actual_cost_usd` e na página, sem avançar `fetched_count` nem persistir
candidatos. O registro de erro contém somente a mensagem genérica
“A página foi recebida, mas não pôde ser persistida.”

Isso confirma que a resposta paga foi recebida e seu custo contabilizado. Não
identifica, por si só, se a falha ocorreu na normalização, consulta de conflitos
ou RPC `complete_prospecting_page`: o código usa a mesma mensagem para a falha
do RPC e para exceções lançadas antes dele. A exceção do RPC não é registrada.

Uma sonda anterior confirmou que o endpoint DataForSEO e a paginação respondem
corretamente em uma busca pequena. Ela não exercitou a gravação da primeira
página paga do app. Os registros disponíveis não mostram quantos itens a
resposta paga continha.
O histórico de auditoria também diverge sobre as migrations que estão
instaladas; o estado remoto precisa ser comparado com as migrations do projeto.

## Objetivo

Fazer a primeira página paga persistir quando seus registros forem válidos,
rejeitar individualmente registros que violem regras de dados conhecidas e
deixar erros sistêmicos diagnosticáveis sem expor payloads de empresas. Uma
falha não pode causar repetição automática de uma página possivelmente cobrada.

## Abordagem

1. Tornar cada etapa observável no server action: coleta, normalização,
   consulta de conflitos, preparação e RPC de conclusão. Registrar o estágio,
   `runId`, `pageId`, custo confirmado, quantidade de itens e código SQLSTATE/
   PostgREST. Derivar mensagem de categoria e nome da constraint por whitelist;
   não registrar `details` nem valores crus de `message`/`hint`, pois o banco
   pode incluir uma linha rejeitada nesses campos. Não registrar credenciais,
   resposta bruta, nomes, telefones, sites ou IDs de empresas.
2. Dividir os filtros `.in()` da consulta de conflitos pelo comprimento
   codificado da URL, mantendo cada consulta abaixo de um teto conservador.
   Juntar as linhas de todas as partes antes de classificar conflitos e
   preservar o primeiro erro PostgREST como causa sanitizável.
3. Validar no servidor os campos sujeitos a constraints conhecidas antes do
   RPC: nome com no máximo 300 caracteres, rating entre 0 e 5, contagens
   inteiras não negativas dentro do intervalo `integer` do PostgreSQL e
   coordenadas em par válido ou ambas ausentes. O limite do nome conta pontos
   de código Unicode como o PostgreSQL `length`. Um item inválido é contado
   como rejeitado e não invalida os demais.
4. Na função SQL, isolar a gravação de cada candidato num bloco de exceção e
   converter apenas violações de dados por linha previamente classificadas em
   rejeição daquele item. Erros de schema, permissões, conexão e outros erros
   sistêmicos devem abortar a página e permanecer visíveis nos logs.
5. Preservar a atomicidade do recibo da página: candidatos aceitos, contadores,
   cursor e custo são confirmados juntos. Erro sistêmico não avança o cursor;
   o custo conhecido permanece registrado pelo caminho de falha existente.
6. Comparar as definições SQL instaladas com as migrations antes de concluir
   que uma falha é causada pelos dados. Atualizar a migration corretiva como
   mudança nova e segura para implantação, sem editar migrations já aplicadas.

## Fluxo de falha

- Erro de formato em um candidato: o candidato é rejeitado, os outros seguem e
  a página é concluída normalmente.
- Erro na consulta de conflitos: a página falha com estágio e erro registrados;
  não se chama o RPC de conclusão e o custo conhecido é finalizado uma única
  vez.
- Erro de dados isolável dentro da gravação: rollback do candidato corrente;
  candidatos seguintes continuam.
- Erro sistêmico no RPC: a transação inteira da conclusão reverte, o custo
  conhecido é registrado pelo recibo de falha, a pesquisa fica `failed` e não
  tenta novamente o mesmo cursor automaticamente.
- Falha sem envelope/custo confirmado: manter custo como desconhecido e nunca
  refazer automaticamente o cursor.

## Arquivos previstos

- `app/actions/prospecting/runs.ts`: estágio de processamento e logs
  estruturados sanitizados para exceções e erros retornados pelo RPC.
- `lib/prospecting/conflicts.ts`: limitar e agregar os filtros por lote de
  consulta sem perder resultados nem erros.
- Novo módulo puro em `lib/prospecting/`: validação de limites dos campos antes
  da gravação, separada de normalização e classificação geográfica.
- Nova migration `supabase/migrations/*_prospecting_candidate_isolation.sql`:
  isolamento por candidato na função de conclusão e atualização consistente
  dos contadores de rejeição.
- `docs/auditoria/evidencias/2026-09-24-prospeccao-persistencia/`: registrar a
  reconciliação das execuções e o status confirmado das migrations, sem inserir
  payloads ou dados pessoais.

## Restrições

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não iniciar novas buscas pagas durante a implementação.
- Não prometer sucesso contínuo diante de indisponibilidade externa; a meta é
  processar respostas válidas, identificar falhas e impedir repetição cega de
  chamadas potencialmente cobradas.
- Uma nova execução real pode ser necessária para confirmar o fluxo corrigido;
  seu custo estimado deve ser exibido antes de iniciá-la.

## Critérios de aceite

- O caminho do erro atualmente genérico distingue normalização, conflitos e
  RPC e registra o código e a categoria segura do erro, sem valores do payload.
- Nenhum log da coleta contém payload de empresas, credenciais ou dados de
  contato.
- Um candidato inválido nas constraints cobertas não impede a gravação dos
  demais candidatos válidos da página.
- Erro sistêmico não é contado como rejeição individual nem mascara schema ou
  infraestrutura desatualizados.
- Custo, cursor e contadores permanecem coerentes em falhas e sucessos.
- O estado das migrations remotas fica registrado no roteiro; não se declara
  validação de uma busca real sem uma execução observada após a correção.
