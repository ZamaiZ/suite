# Pesquisa local de CNPJ por leitura direta dos CSVs

**Status:** aguardando revisão do detalhamento de arquivos temporários  
**Data:** 2026-09-25

## Objetivo

Pesquisar CNPJs na base local da Receita sem criar um segundo banco permanente. Cada execução lê os CSVs originais em streaming, usa memória limitada aos candidatos e resultados daquela prospecção e grava no Supabase somente os resultados da pesquisa, com origem rastreável e controles para cancelar e limpar. O worker recebe os candidatos pelo `stdin`; um arquivo temporário contendo apenas os matches fica na pasta de estado local durante a conclusão dos chunks e é removido ao concluir, cancelar ou falhar.

## Evidências e estado inicial

- Os diretórios `Empresas0` a `Empresas9` e `Estabelecimentos0` a `Estabelecimentos9` ocupam cerca de 24 GB no computador.
- O piloto estimou um índice completo de aproximadamente 705 MB; o arquivo temporário chegou a cerca de 8,8 GB antes de o worker ser encerrado.
- O worker foi encerrado após autorização do usuário. O índice parcial, o piloto, o estado e o lock foram removidos. Os CSVs originais foram preservados; o espaço livre no C: voltou a aproximadamente 19,8 GB.
- O código já lê CSVs linha a linha em Latin-1. O fluxo atual de pesquisa usa SQLite/FTS para consultas, e só persiste dados no Supabase depois de concluir o matching local.
- A leitura direta não consome dezenas de GB adicionais no disco, mas volta a ler a base — cerca de 24 GB — em cada execução. A duração ainda precisa ser medida no computador do usuário.

## Decisões de arquitetura

### 1. Substituir a construção integral por streaming

Remover do fluxo de uso o piloto e a construção do SQLite integral. A validação local confirma os 20 arquivos esperados, layout de colunas, competência da Receita, tamanhos e datas. Depois, a pesquisa abre cada arquivo sequencialmente com o parser em streaming existente.

Antes de ler a Receita, carregar somente candidatos da prospecção atual e montar mapas em memória por telefone, CEP e tokens de nome. Ler `Empresas` para identificar bases legais candidatas e ler `Estabelecimentos` uma vez para cruzar essas bases com CNPJ, telefone, CEP, nome fantasia, situação, município e CNAE. Acumular apenas os melhores candidatos por estabelecimento-alvo; nunca manter linhas completas da base em memória.

Manter validação do CNPJ, geração dos tokens, limites de truncamento e regras de confiança/desempate do fluxo atual. A busca por telefone e CEP é exata. A busca textual usa mapa invertido dos tokens dos candidatos para evitar comparar cada linha com todos os candidatos. Como o índice FTS atual e o mapa em memória são mecanismos diferentes, a implementação deve preservar a semântica observável: resultados acima dos limites atuais tornam-se ambíguos, e os resultados dentro dos limites passam pelo mesmo score e critério de desempate. Se uma execução exceder os limites operacionais de memória ou duração, ela termina com estado explicativo, sem resultado parcial aplicado.

### 2. Métricas para a varredura e para cada execução

Exibir fase, arquivo atual, bytes lidos, linhas processadas, candidatos carregados/processados, tempo decorrido, velocidade observada, última atualização e espaço livre. Nas fases de gravação, mostrar chunks enviados e resultados agregados: sugestões, ambíguos, não encontrados, ignorados e falhas.

Não exibir percentual ou ETA preciso antes de haver uma estimativa calibrada. Com o primeiro trecho de leitura, pode-se mostrar taxa observada e uma faixa estimada, sempre identificada como estimativa.

Registrar eventos estruturados e limitados localmente: início, validação de origem, arquivo/fase, progresso agregado, cancelamento, commit, conclusão e erro. Os eventos não incluem nomes, telefones, endereços ou CNPJs dos candidatos. No navegador, usar polling serial: agendar a próxima consulta somente depois da resposta anterior.

O único arquivo temporário com dados de matches fica dentro de `PROSPECTING_CNPJ_STATE_DIR` (ou da configuração legada), tem limite de tamanho, e é apagado assim que o staging termina ou é abortado. A tela informa a pasta usada e mostra quando esse resultado temporário será removido. Arquivos órfãos são apagados após confirmar que o worker terminou e que passaram 24 horas.

### 3. Cancelamento cooperativo

Dar a cada execução um identificador e um sinal de cancelamento local. O worker verifica o sinal em intervalos definidos de linhas e entre arquivos. Ao cancelar durante a varredura, fecha os arquivos, grava `cancelled` e retorna sem iniciar o staging no Supabase.

Durante o staging, abortar a importação temporária pelo RPC existente. O commit no Supabase é atômico; uma vez iniciado, a interface aguarda o resultado em vez de alegar que cancelou. Não encerrar o processo à força nem deixar a UI presa em estado ativo quando o worker morrer.

### 4. Inspeção e limpeza local

Como não haverá índice persistente, a tela local mostra configuração e saúde dos CSVs, versão/competência, quantidade de arquivos, tamanho total, última varredura e logs locais. Remove-se da UI o estado “criar/apagar índice”.

Uma ação de limpar dados locais apaga somente eventos e estado transitório de execução. Valida caminhos dentro do diretório local de estado do Suite e bloqueia a limpeza se algum worker estiver ativo. Nunca toca nos CSVs de origem.

### 5. Limpeza rastreável no Supabase

Manter a origem `receita_local_index` para identificar os resultados da pesquisa direta. Exibir contagens por execução e origem antes de qualquer exclusão. Uma função RPC transacional, protegida por `auth.uid()` e associação comercial, remove somente importações, batches, candidatos de batch, tentativas e matches locais da prospecção selecionada.

Se um candidato tiver CNPJ confirmado por um match local, a limpeza pode limpar esse valor somente quando `cnpj_confirmed_match_id` apontar para o match local removido. Preservar matches, tentativas e valores de CNPJ de outras origens. A UI mostra quantos CNPJs confirmados locais serão removidos e exige confirmação explícita. Limpeza local e limpeza do Supabase ficam em ações separadas.

## Fluxos

### Pesquisa

`validar base → carregar candidatos → varrer Empresas → varrer Estabelecimentos → resumir matches → staging em chunks → commit atômico → resumo final`

O estado da execução acompanha cada fase. Cancelamento antes do staging não grava resultados. Cancelamento durante staging apaga apenas a importação temporária. O arquivo final de resultados só é aplicado após o commit.

### Reutilização

Não há índice para reconstruir nem espaço extra permanente. Cada execução valida a competência dos mesmos CSVs e faz uma nova varredura. A chave da base continua útil para registrar qual versão gerou os resultados.

### Limpeza

**Limpar estado e eventos locais** e **Apagar resultados locais desta prospecção** são controles separados, cada um com escopo e contagens visíveis. Nenhum controla ou remove arquivos originais da Receita.

## Critérios de aceite

- Uma pesquisa percorre os CSVs sem criar uma cópia persistente da base e sem manter a base inteira em memória.
- O progresso mostra arquivo, linhas/bytes lidos, fase, duração e atividade recente; o polling não cria requisições concorrentes.
- O cancelamento termina em estado claro e não deixa resultados parciais no Supabase.
- O matching valida CNPJ e mantém limites de truncamento, score e desempate do fluxo atual; qualquer limite operacional aparece no resumo.
- A limpeza local remove somente estado/logs transitórios do Suite.
- A limpeza no Supabase afeta somente a origem local e a execução selecionada; matches de outras origens permanecem.
- Os CSVs originais permanecem intactos. A entrada de candidatos não é gravada em arquivo local; o resultado local transitório contém somente matches e não é mantido após o estado terminal.
- Os avisos `maxWidth` e `ECONNRESET` continuam sendo diagnosticados separadamente; não são tratados como prova de falha da varredura sem evidência.

## Restrições do projeto

- Não usar Git, build, lint, typecheck ou testes, conforme as instruções locais do repositório.
- Antes de editar código, consultar a documentação Next.js instalada em `node_modules/next/dist/docs/` e seguir a skill `suite-frontend` para as alterações da interface.
- Esta especificação aguarda revisão do usuário. Nenhum código de implementação foi alterado.
