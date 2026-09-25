# Gate de fontes gratuitas para busca de CNPJ

Data da verificação: 2026-09-24

## Decisão

**Nenhuma fonte aprovada para integração.** A pesquisa encontrou diretórios
com busca cadastral por CNPJ conhecido e serviços que anunciam busca por nome,
mas não confirmou para nenhum serviço os três requisitos simultâneos:

1. busca automatizada sem CNPJ prévio;
2. cota gratuita;
3. permissão documentada para uso comercial automatizado.

O gate do plano permanece fechado. Não foi feita chamada com dados de empresas
do Suite.

| Fonte | Busca sem CNPJ | Cota grátis | Uso comercial automatizado | Resultado |
|---|---|---|---|---|
| Consulta CNPJ gov.br | Não | Não relevante à descoberta | Não avaliado | Rejeitada para descoberta |
| API CNPJ Finder/OpenCNPJ | Documentação consultada indica lookup por CNPJ | Sim; documentação anuncia 50 req/s por IP | API lookup documentada; automação da busca nominal do site não autorizada | Rejeitada para descoberta |
| Utiliza | Não; endpoint consultado exige CNPJ conhecido | Sim; 1.000/mês e 60/min com token | Documentação descreve uso educacional | Rejeitada para descoberta |
| APICNPJ | Anúncio público sugere busca por nome; endpoint não confirmado | Não confirmado | Não confirmado | Não aprovada |
| Aventity | Anúncio público sugere busca por nome; endpoint não confirmado | Não confirmado | Não confirmado | Não aprovada |

## Fontes verificadas

### Serviço governamental de Consulta CNPJ

- Referência: https://www.gov.br/conecta/catalogo/apis/consulta-cnpj
- O serviço descreve a consulta a partir do número de CNPJ.
- Não atende à descoberta por nome empresarial.
- Resultado: `rejected` para descoberta; pode ser reavaliado como consulta
  secundária se acesso, autenticação, limites e uso comercial forem confirmados.

### CNPJ Finder / OpenCNPJ

- API: https://www.cnpjfinder.com.br/api-docs
- Busca no site: https://www.cnpjfinder.com.br/busca
- A documentação anuncia API gratuita sem cadastro e dados obtidos da OpenCNPJ.
- A política apresentada informa limite de 50 requisições por segundo por IP,
  herdado da OpenCNPJ.
- O endpoint documentado é uma consulta cadastral por CNPJ conhecido.
- O site tem um link “Buscar por nome”, mas a documentação consultada não
  autoriza automação dessa interface nem define uma API de descoberta por nome.
- Resultado: `rejected` para integração de descoberta; busca manual do site não
  foi automatizada.

### Utiliza

- Referência: https://utiliza.net/apis/cnpj
- A documentação anuncia 1.000 consultas mensais e 60 requisições por minuto na
  conta grátis, com token.
- O endpoint consultado recebe CNPJ conhecido e devolve dados cadastrais.
- A página descreve a ferramenta como educacional; uso comercial automatizado
  para descoberta por nome não foi confirmado.
- Resultado: `rejected` para integração de descoberta.

## Pistas ainda não comprovadas

Resultados públicos de pesquisa anunciaram “busca por nome” para APICNPJ e
Aventity, além de busca por empresas em serviços semelhantes. A documentação
oficial, quota grátis, termos comerciais e endpoint não puderam ser
confirmados. Não usar esses serviços até verificar os quatro pontos em páginas
oficiais do fornecedor.

Uma consulta subsequente ao mecanismo de busca apresentou desafio anti-bot.
A pesquisa parou nesse ponto; o desafio não foi contornado. Nenhuma chamada de
API nem tentativa de contornar acesso foi feita.

## Próximo gate

Reabrir a implementação somente quando houver documentação oficial que prove
busca por nome sem CNPJ prévio, cota gratuita e uso comercial automatizado. Uma
alternativa a avaliar separadamente é indexar dados abertos da Receita Federal;
isso exige análise própria de licença, volume de download, frequência de
atualização e custo operacional, e não foi aprovado por este gate.

## Avaliação complementar: OpenCNPJ e BigQuery

Verificação de 2026-09-24 dos documentos em https://opencnpj.org/docs e do endpoint público https://api.opencnpj.org/info:

- A API documentada continua sendo lookup por CNPJ; não descobre CNPJ por nome.
- A documentação aponta os datasets públicos do OpenCNPJ no BigQuery para pesquisas analíticas e em massa. Isso oferece um caminho por nome sem baixar e indexar a base no Suite.
- O dataset `receita` informou 73.354.529 registros, atualização em `2026-09-15T00:54:41Z`, ZIP de 14.281.241.564 bytes (aprox. 14,3 GB decimais) e campos de razão social/nome fantasia, situação, UF, município e CNAE.
- A documentação do BigQuery Sandbox descreve uso sem conta de faturamento e até 1 TiB de consultas mensais no nível gratuito. A franquia pertence ao projeto Google que executa a consulta, pode ser compartilhada com outras consultas do projeto e não constitui capacidade ilimitada garantida.
- A licença aplicável aos dados publicados no BigQuery, o endpoint/programa de autenticação para automação server-side e o volume real lido para consultar nomes ainda não foram comprovados. Também não foi executada consulta nem transferido o ZIP.

Referências adicionais:

- OpenCNPJ — documentação: https://opencnpj.org/docs
- OpenCNPJ — metadados: https://api.opencnpj.org/info
- Google Cloud — BigQuery Sandbox: https://docs.cloud.google.com/bigquery/docs/sandbox

Decisão complementar: OpenCNPJ/BigQuery é uma pista tecnicamente mais promissora que indexação local para pesquisa por nome, mas não está aprovado para integração no Suite até comprovar licença/uso comercial dos dados, autenticação automatizada permitida e custo de uma consulta em lote realista. Não alterar produto nesta etapa.
### Continuação da avaliação OpenCNPJ/BigQuery (2026-09-24)

- A documentação de Consultas Analíticas identifica a tabela `opencnpj-bigquery.public.receita` e recomenda BigQuery para enriquecimento batch e prospecção. A API do OpenCNPJ é descrita como consulta pontual por CNPJ conhecido.
- O repositório oficial `https://github.com/Hitmasu/OpenCNPJ` informa licença MIT para o software/pipeline. Essa licença não declara a licença dos registros de CNPJ replicados no BigQuery.
- O README do pipeline mostra publicação em projeto BigQuery próprio do operador (`ProjectId`) autenticado com credenciais Google de service account. Isso prova como o operador publica sua tabela, não que a integração do Suite possa usar credenciais sem conta/projeto próprio nem que a consulta seja autorizada comercialmente.
- A página oficial da Receita tentada no caminho conhecido retornou 404. O endpoint do catálogo `dados.gov.br/api/3/action/package_show` retornou 401; a página pública do catálogo respondeu 200, mas exige JavaScript e não expôs licença legível nesta consulta. Não contornar a autenticação.
- O Sandbox do Google documenta experiência sem conta de faturamento e franquia de 1 TiB/mês. Um dry run autenticado é necessário para medir bytes processados e confirmar que a consulta por nomes cabe no limite definido. Sem projeto Google da equipe, não foi possível executar esse dry run.

Referências:

- Tabela/guia analítico OpenCNPJ: https://opencnpj.org/docs (tabela `opencnpj-bigquery.public.receita`)
- Repositório OpenCNPJ e licença do código: https://github.com/Hitmasu/OpenCNPJ
- Conjunto Receita no Catálogo de Dados Abertos: https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj
- Google BigQuery Sandbox: https://docs.cloud.google.com/bigquery/docs/sandbox

Decisão: a rota continua tecnicamente promissora, com consulta agrupada e dry run antes da execução, mas permanece não aprovada para integração comercial até obter o termo/licença aplicável aos dados publicados e validar autenticação e bytes lidos em um projeto da equipe. Não habilitar código nem presumir cobertura total.

### Decisão do usuário e estado da implementação (2026-09-24)

O usuário aprovou implementar OpenCNPJ/BigQuery com fontes gratuitas, pesquisa em lote, dry run e teto de bytes. A implementação foi adicionada, mas o provedor continua inativo sem `PROSPECTING_CNPJ_BIGQUERY_PROJECT_ID` e `PROSPECTING_CNPJ_GOOGLE_CREDENTIALS_JSON`. A licença específica dos registros republicados e a política de retenção continuam sem comprovação independente; a aprovação do desenho não substitui essa verificação antes da ativação comercial. Nenhum dry run real foi executado porque não há projeto/credenciais fornecidos. Consulte `manual-verification.md` para a revisão de código e limites.

Para manter o uso dentro da franquia gratuita, o projeto configurado deve ser Sandbox sem conta de faturamento vinculada. `maximumBytesBilled` limita uma consulta individual; não representa teto mensal quando há faturamento habilitado.
