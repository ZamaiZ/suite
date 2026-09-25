# Enriquecimento de CNPJ na prospecção — Design

## Objetivo

Permitir que a equipe comercial pesquise CNPJs para candidatos já encontrados
na prospecção, usando fontes gratuitas que permitam busca automatizada por
nome empresarial. A pesquisa deve reduzir o trabalho manual sem afirmar que
todo candidato terá um resultado nem associar automaticamente um CNPJ apenas
porque o número é estruturalmente válido.

O dado confirmado deve acompanhar o candidato e ser copiado para o lead quando
ele for importado. Os filtros gerais da tabela de prospecção são outra etapa e
não fazem parte desta entrega.

## Entendimento acordado

- A fonte deve ser gratuita e permitir uso comercial automatizado, com limites
  e condições de uso claros.
- Nenhum provedor será ativado antes de confirmar que aceita pesquisa sem um
  CNPJ de entrada, que a cota é gratuita e que os termos permitem este uso.
- A busca começa por ação explícita sobre candidatos selecionados; abrir uma
  tela ou alterar um filtro não dispara consultas externas.
- As fontes são consultadas em sequência, respeitando cotas e limites de taxa.
- Um CNPJ encontrado, sua validade estrutural e sua correspondência com a
  unidade prospectada são fatos separados.
- Correspondências incertas, múltiplas ou com filial divergente exigem revisão
  humana.
- Google e LinkedIn não serão automatizados por scraping. A página de busca de
  um diretório também não será tratada como API sem autorização documentada.
- Não há promessa de encontrar CNPJ para todas as empresas.
- Não haverá filtros gerais nesta entrega, chamadas pagas, scraping de páginas
  ou importação automática de sócios e outros dados pessoais.

## Evidência inicial de fontes

Pesquisa pública feita em 2026-09-24 encontrou:

- A API governamental de consulta de CNPJ descreve entrada por número de CNPJ;
  ela serve para validar um número conhecido, não para descobri-lo a partir do
  nome.
- A documentação da CNPJ Finder anuncia API gratuita baseada na OpenCNPJ e
  limite de 50 requisições por segundo por IP. A documentação da API é de
  consulta cadastral por CNPJ. O link “Buscar por nome” é uma página do site e
  não comprova autorização para automatizar essa interface.
- A Utiliza anuncia plano grátis de 1.000 consultas por mês e 60 requisições por
  minuto por conta, com token. A documentação encontrada é de consulta de um
  CNPJ já conhecido e descreve uso educacional; não atende aos critérios de
  descoberta comercial desta entrega.
- APICNPJ e Aventity apareceram como possíveis fontes de busca por nome. Cota
  gratuita, uso comercial automatizado e endpoint de descoberta ainda não
  foram confirmados; são pistas de pesquisa, não integrações aprovadas.

Referências consultadas:

- Catálogo gov.br de APIs — Consulta CNPJ:
  https://www.gov.br/conecta/catalogo/apis/consulta-cnpj
- CNPJ Finder — documentação API:
  https://www.cnpjfinder.com.br/api-docs
- CNPJ Finder — busca por nome (interface pública, sem autorização de
  automação confirmada): https://www.cnpjfinder.com.br/busca
- Utiliza — API CNPJ:
  https://utiliza.net/apis/cnpj

O levantamento não comprovou um provedor elegível. A confirmação de pelo menos
uma fonte é um gate antes de ativar consultas no produto. A arquitetura não
deve apresentar uma lista simulada de resultados quando não houver provedor
disponível.

## Arquitetura

### Fluxo de dados

```text
usuário seleciona candidatos
          │
          ▼
ação autenticada cria lote de enriquecimento
          │
          ▼
consulta sequencial a fontes aprovadas
          │
          ▼
normalização de resultados e validação estrutural do CNPJ
          │
          ▼
comparação de nome, cidade, endereço, telefone e domínio
          │
          ├── sugestão clara ── revisão/confirmação humana
          ├── ambíguo ───────── revisão humana
          ├── não encontrado
          └── fonte indisponível ou limitada
                                  │
                                  ▼
                     candidato guarda CNPJ confirmado
                                  │
                                  ▼
                      importação copia CNPJ ao lead
```

### Adaptadores de fonte

Um adaptador encapsula autenticação, endpoint, mapeamento de resposta, limite
de requisições, cota e condição de uso de uma fonte. O orquestrador recebe uma
consulta normalizada e uma lista de resultados; não depende do formato de um
provedor específico.

Uma fonte só pode ser configurada como ativa depois de uma verificação
documentada que confirme todos estes pontos:

1. aceita busca pelo nome/razão social sem exigir CNPJ conhecido;
2. permite uso comercial automatizado nos termos publicados;
3. tem cota gratuita e limite de taxa identificáveis;
4. permite guardar os campos e a URL de evidência necessários ao fluxo;
5. retorna identificador CNPJ e informação suficiente para comparar a
   empresa/unidade.

Se nenhum provedor passar, a ação explica que a busca automática não está
disponível. Uma falha de rede, limite 429, cota esgotada e resposta vazia são
estados diferentes. Erro ou indisponibilidade nunca vira “não encontrado”.

O adaptador não deve usar busca pública do Google, LinkedIn, CAPTCHA ou páginas
de diretórios cuja automação não esteja autorizada. A fonte oficial consultada
por número pode, no futuro, ser usada como verificação secundária se seu acesso
e seus limites forem validados; ela não substitui a fonte de descoberta.

### Orquestrador

- Um lote é criado para os candidatos selecionados em uma execução de
  prospecção.
- O servidor processa um candidato por vez e não faz consultas paralelas.
- Nenhuma chamada externa ocorre no carregamento da página, ao digitar ou ao
  selecionar/desselecionar linhas.
- O lote registra progresso e pode ser retomado sem repetir tentativas
  concluídas.
- Cada nova pesquisa explícita cria uma tentativa auditável; resultados
  anteriores não são sobrescritos sem histórico.
- Limite de taxa, cota restante e `Retry-After` são respeitados. Se uma fonte
  estiver limitada, o lote pausa e pode continuar depois.
- A interface mostra candidatos processados, sugestões, revisão pendente,
  resultados ausentes e falhas da fonte.

### Correspondência e validação

O domínio mantém campos distintos para:

1. **CNPJ encontrado** — texto de 14 posições preservado como string, nunca
   convertido para número;
2. **validade estrutural** — formato e dígitos verificadores calculados pelas
   regras vigentes da Receita Federal, sem assumir que toda inscrição é somente
   numérica;
3. **situação cadastral reportada** — situação que a fonte informa e quando foi
   consultada; ausência de status ou fonte desatualizada não pode ser descrita
   como confirmação oficial;
4. **identidade confirmada** — evidências indicam que aquele estabelecimento
   corresponde ao candidato de prospecção.

O CNPJ válido estruturalmente não confirma situação cadastral nem identidade.
Dados de cada resultado devem conter, quando disponíveis, CNPJ, razão social,
nome fantasia, situação, cidade/UF, endereço, telefone e domínio/site. O fluxo
compara os campos com candidato original (nome público, cidade/UF, endereço,
telefone e site/domínio).

Estados de resultado:

- `not_searched` — não há tentativa;
- `searching` — lote processando;
- `suggestion` — há resultado plausível, aguardando confirmação;
- `needs_review` — múltiplas correspondências, filial incerta ou dados
  divergentes;
- `confirmed` — pessoa comercial confirmou qual CNPJ corresponde à empresa;
- `not_found` — todas as fontes aprovadas responderam sem correspondência;
- `source_limited` — cota ou limite impediu completar a consulta;
- `source_not_configured` — nenhuma fonte passou pelo gate de habilitação;
- `source_unavailable` — uma fonte aprovada falhou tecnicamente.

Uma correspondência que pareça clara pode ser apresentada como sugestão, mas
não é promovida a `confirmed` sem confirmação explícita do usuário. A tela deve
mostrar razão social, endereço/unidade, fonte e evidência para que a escolha
entre matriz e filial seja revisável. A razão social nunca substitui o nome
comercial do candidato.

`confirmed` atesta que uma pessoa confirmou a correspondência entre candidato e
estabelecimento; não significa que a situação cadastral foi consultada
diretamente na Receita. Se um provedor aprovado trouxer situação cadastral, ela
é exibida com fonte e data próprias. Uma consulta oficial complementar exige
seu próprio gate de acesso gratuito e termos.

A confirmação manual registra ator e data. O CNPJ confirmado permanece
imutável em tentativas posteriores até que uma pessoa confirme a substituição;
divergências criam nova revisão.

### Persistência

O modelo mantém histórico de tentativas/resultados ligado ao candidato, com:

- provedor e versão do adaptador;
- parâmetros de consulta necessários para auditoria, sem segredos;
- resultados normalizados, URL da fonte e data da observação;
- status da tentativa, falha sanitizada e estado de revisão;
- CNPJ confirmado e dados de quem/quando confirmou.

O produto não persiste payload bruto integral do fornecedor nem dados de sócios.
O histórico de evidência fica ligado ao candidato mesmo após importação.

`leads` ganha uma coluna `cnpj` opcional, separada de `tax_id`: o campo existente
`tax_id` pertence ao fechamento e a constraint atual exige que ele fique nulo
fora das etapas de fechamento. A nova coluna é textual e validada conforme as
regras vigentes. A importação copia apenas CNPJ confirmado; sugestão não
confirmada não é propagada. Leads importados sem CNPJ continuam válidos e podem
ser enriquecidos posteriormente.

### Interface

- A tabela de candidatos ganha coluna CNPJ/status.
- Com um ou mais candidatos selecionados, a ação **Pesquisar CNPJ** cria um
  lote. Se nenhuma fonte estiver habilitada, mostra indisponibilidade e motivo.
- O progresso do lote é visível e cada linha mostra estado e número de
  tentativas.
- Uma linha abre painel de revisão com correspondências, razão social, unidade,
  localização, fonte, link de evidência e data.
- A pessoa seleciona a correspondência e confirma o CNPJ. Candidatos ambíguos
  podem permanecer sem CNPJ confirmado.
- A tela do lead exibe o CNPJ confirmado e permite correção conforme o padrão
  atual de edição do lead.
- A importação copia CNPJ confirmado junto aos demais campos do candidato.
- Sem resultados, a interface mostra “não encontrado”; falha e limite da fonte
  usam mensagens distintas.

Os novos controles seguem o skill `.agents/skills/suite-frontend/SKILL.md` e os
padrões de tabela, campo, diálogo e espaçamento já usados no Suite.

## Segurança e acesso

- Toda ação exige integrante comercial autenticado e revalida os IDs dos
  candidatos e da execução no servidor.
- Chaves de fontes externas ficam somente no servidor.
- RLS restringe lotes, tentativas e evidências a integrantes comerciais.
- Consultas, erros e respostas devolvidas à interface não expõem segredos nem
  payload cru.
- Parâmetros de nome e telefone são usados apenas na consulta empresarial e não
  são enviados a fonte não aprovada.

## Erros e estados explícitos

| Condição | Comportamento |
|---|---|
| Nenhuma fonte aprovada/configurada | `source_not_configured`; não consulta e explica o gate pendente |
| Resultado sem CNPJ válido estruturalmente | Mantém apenas como evidência inválida; não pode confirmar |
| CNPJ válido, mas nome/cidade divergentes | `needs_review` |
| Mais de uma filial plausível | `needs_review`; não escolhe matriz por padrão |
| Nenhum resultado em todas as fontes | `not_found` |
| HTTP 429/cota esgotada | Pausa o lote como `source_limited`; respeita `Retry-After` |
| Timeout/falha do serviço | `source_unavailable`, distinto de ausência de resultado |
| Nova tentativa com CNPJ confirmado divergente | Preserva o confirmado e abre revisão |
| Corrida entre duas pesquisas | Lease/idempotência impede tentativa duplicada por candidato/lote |

## Observabilidade e medição

Cada lote registra fonte, versão, candidatos consultados, tentativas concluídas,
sugestões, confirmações humanas, ambiguidades, não encontrados, respostas
limitadas, falhas e tempos. Métricas mostram cobertura por fonte e concordância
das sugestões confirmadas, mas não declaram cobertura total de empresas.

Antes de habilitar um provedor, uma sondagem pequena e autorizada valida
endpoint, busca por nome, limite, formato da resposta, CNPJ, campos de endereço,
regras de armazenamento e termos comerciais. A evidência sanitizada fica em
`docs/auditoria/evidencias/`.

## Fora do escopo

- filtros gerais para nota, site ou outros campos;
- integração paga ou crédito por consulta;
- scraping de Google, LinkedIn ou interfaces sem autorização explícita;
- CNPJ encontrado automaticamente sem revisão;
- enriquecimento de sócios, decisores, e-mails ou telefone pessoal;
- garantia de obter CNPJ de todas as empresas;
- importação automática de dados cadastrais além do CNPJ confirmado;
- alteração do fluxo de planilha.

## Critérios de aceitação

1. É possível iniciar pesquisa para candidatos selecionados sem chamadas por
   evento de digitação, carregamento ou filtros.
2. Nenhuma fonte pode ser ativada sem busca documentada por nome, cota gratuita
   e autorização de uso automatizado comercial.
3. As chamadas são sequenciais, auditáveis, retomáveis e respeitam limites.
4. O resultado separa CNPJ encontrado, validade estrutural e identidade
   confirmada.
5. Matriz/filial e resultados múltiplos ficam explícitos e exigem confirmação.
6. CNPJ confirmado é salvo no candidato e copiado para o lead na importação;
   sugestão não confirmada não é copiada.
7. Ausência, limite, erro técnico e fonte não configurada são estados distintos.
8. Nenhuma tela promete completude; métricas mostram cobertura medida por fonte.
9. CNPJ suporta as regras atuais da Receita Federal e é armazenado como texto.

## Restrições de execução

As instruções locais proíbem executar `git`, `typecheck`, `build`, `lint` e
`test`, e determinam que não haverá testes. A implementação deve respeitar essas
restrições. Antes de qualquer alteração Next.js, consultar os guias relevantes
em `node_modules/next/dist/docs/`; antes de alterar interface, ler o skill
Suite Frontend.

## Proposta de revisão: OpenCNPJ via BigQuery

A pesquisa confirmou que o OpenCNPJ documenta a tabela pública `opencnpj-bigquery.public.receita` e recomenda esse dataset especificamente para enriquecimento batch, prospecção de leads e relatórios comerciais. A API direta permanece restrita a CNPJ conhecido. O BigQuery Sandbox oferece 1 TiB/mês de leitura no nível gratuito sem conta de faturamento.

O usuário aprovou a implementação condicional deste desenho em 2026-09-24. O provedor permanece inativo até existir configuração de servidor válida; consulta real exige dry run abaixo do teto por lote. A licença específica dos registros republicados e os termos aplicáveis à execução comercial seguem pendentes de confirmação antes da ativação em produção.

1. Um lote explícito de até 50 candidatos vira uma consulta SQL parametrizada única, comparando nome normalizado e município/UF e retornando apenas razão social, nome fantasia, CNPJ, situação cadastral, endereço, telefone e CNAE necessários para revisão.
2. O servidor executa dry run primeiro e bloqueia a consulta se a leitura estimada exceder um teto configurável por lote (`maximumBytesBilled`). A execução fica serial, sem retries automáticos; o projeto Google deve ser dedicado ao Suite para isolar a franquia de 1 TiB/mês.
3. A autenticação usa service account no servidor, com project ID e credencial armazenados em secret de ambiente; nenhum segredo ou SQL com dados de candidatos vai ao cliente. A primeira ativação requer dry run em projeto real e confirmação de Sandbox sem billing account.
4. O banco persiste apenas campos normalizados do match, fonte, data de atualização do dataset e referência de consulta; não persiste resposta bruta nem dados de sócios. Nenhum match é confirmado automaticamente; a equipe escolhe o estabelecimento correto.
5. Se o dry run exceder o limite, a fonte estiver sem configuração ou o projeto chegar à quota, a tentativa para com estado distinto e não registra “não encontrado”.

Limites: a Receita/OpenCNPJ atualiza a base por publicação periódica; nomes divergentes, MEI, matriz/filial e empresas sem correspondência clara podem não ser resolvidos. A franquia gratuita é do Google e pode mudar. A documentação pública do OpenCNPJ promove uso comercial de BigQuery, mas não encontramos licença separada dos dados republicados; esse ponto deve permanecer registrado para revisão antes de produção.

Esta é uma proposta para revisão, não autorização para habilitar chamadas ou alterar código.
