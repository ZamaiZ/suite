# Canal de prospecção por segmento e cidade — Design

## Objetivo

Criar um terceiro canal de entrada de leads, ao lado do cadastro manual e da
importação de planilha, que descubra o maior número possível de empresas
relevantes para um segmento dentro de um município brasileiro.

A descoberta usa o DataForSEO Business Listings. O resultado não entra
diretamente no funil: primeiro vira candidato de prospecção, passa por validação
territorial, de categoria, duplicidade e atualidade, e só então pode ser
selecionado para conversão em lead.

O sucesso não é afirmar que a base contém todas as empresas existentes. O
contrato é recuperar todos os registros que a DataForSEO declara para as
categorias e a área consultadas, dentro do orçamento autorizado, e separar de
forma explícita o que foi validado, o que ficou ambíguo e o que foi rejeitado.

## Resultado esperado

Para uma pesquisa como **Demolição em São Paulo**, um integrante comercial
consegue:

1. escolher o segmento e a cidade;
2. confirmar as categorias DataForSEO associadas ao segmento;
3. ver o custo máximo autorizado antes da coleta;
4. iniciar, acompanhar, pausar e retomar a paginação;
5. revisar empresas verificadas dentro do município;
6. selecionar uma ou várias empresas;
7. revalidá-las ao vivo;
8. converter as elegíveis em leads sem criar duplicatas.

## Evidência e restrições do fornecedor

Documentação consultada em 2026-09-22:

- `POST /v3/business_data/business_listings/search/live`;
- `GET /v3/business_data/business_listings/categories`;
- `GET /v3/business_data/business_listings/locations`;
- página pública de preços do Business Listings.

O endpoint de busca:

- aceita até 10 categorias;
- recebe `location_coordinate` no formato `latitude,longitude,radius`, com raio
  em quilômetros;
- devolve até 1.000 empresas por chamada;
- usa `offset` para paginação comum e `offset_token` para volumes grandes;
- devolve `total_count`, `count`, `offset`, `offset_token` e `items`;
- cobra por chamada e por item retornado;
- informa o custo real no envelope de cada resposta;
- devolve `last_updated_time`, porque a base é indexada e não deve ser tratada
  como representação ao vivo do Google Maps.

Na referência pública consultada, o preço era US$ 0,012 por chamada mais
US$ 0,00036 por item: até US$ 0,372 para uma página de 1.000 itens. Esses
valores documentam ordem de grandeza, mas **não serão fixados como preço da
conta no produto**. A estimativa operacional vem de `/appendix/user_data`, e o
custo real gravado vem da resposta paga.

O catálogo publicado em 2026-09-01 contém `demolition_contractor`. A lista de
localidades informa aproximadamente 8,49 milhões de estabelecimentos no
Brasil. Contagem de catálogo é cobertura da base, não garantia de atualidade ou
de exaustividade do mundo real.

## Decisões fechadas

### Business Listings descobre; Google Business Info confirma

`business_listings/search/live` é a fonte de cobertura. Antes da importação, o
candidato selecionado passa por `google/my_business_info/live` usando o
`place_id`. A confirmação atualiza os campos básicos e impede que um registro
removido ou encerrado entre no funil sem aviso.

O Google Maps SERP não entra como segunda fonte de descoberta nesta entrega.
Unir dois conjuntos ranqueados aumentaria custo e duplicação sem oferecer uma
medida clara de cobertura adicional.

### Categoria é explícita e reutilizável

O texto comercial do segmento não é enviado como busca livre. Cada segmento do
Suite possui uma associação revisável com uma a dez categorias oficiais do
Business Listings.

Exemplo inicial:

| Segmento | Categoria principal | Categorias adicionais |
|---|---|---|
| Demolição | `demolition_contractor` | nenhuma por padrão |

`construction_company`, `contractor` e `excavating_contractor` não entram
automaticamente. São categorias mais amplas ou semanticamente vizinhas e
podem aumentar falsos positivos. Um usuário pode adicioná-las conscientemente
ao mapeamento do segmento.

Na primeira pesquisa de um segmento ainda não configurado, a tela exige a
seleção das categorias e salva o mapeamento. Nas pesquisas seguintes, segmento
e cidade continuam sendo as únicas decisões obrigatórias; o mapeamento salvo
fica visível e editável antes do pagamento.

### Município é polígono, não raio nem texto de endereço

O Business Listings consulta um círculo. Municípios não são círculos e São
Paulo faz divisa com outras cidades densas. Usar apenas raio ou
`address_info.city` produziria falsos positivos com aparência de precisão.

A fronteira territorial vem das APIs oficiais do IBGE:

1. resolver cidade + UF para o código do município;
2. obter a malha municipal em GeoJSON;
3. calcular o centro do envelope e o raio até o vértice mais distante;
4. acrescentar margem técnica de 2% ao raio;
5. consultar o Business Listings com o círculo resultante;
6. classificar cada coordenada com point-in-polygon sobre o GeoJSON.

`address_info.city` e `address_info.region` servem como evidência adicional.
Não substituem a geometria. Se a malha não puder ser resolvida, a pesquisa não
começa e nenhuma coleta paga é feita. Se um item não tiver coordenada, ele fica
como `localidade_ambigua`: continua visível, mas não pode ser importado até ser
revalidado com coordenada.

A malha e seus derivados são cacheados por município no banco. Centroide em
cache de processo, usado hoje por `lib/locationiq/city-center.ts`, continua
servindo à busca de perfil existente, mas não é a fronteira deste canal.

### Candidato não é lead

Resultados pagos são armazenados numa área de prospecção. Eles não ocupam a
fila dos SDRs até que alguém os selecione e confirme a importação.

Um candidato pode estar:

- disponível;
- selecionado;
- ignorado;
- duplicado;
- importado;
- desatualizado;
- fora do município;
- com localidade ambígua;
- incompatível com a categoria.

Ignorar não apaga o candidato. Uma pesquisa futura pode reencontrá-lo e mostrar
o julgamento anterior.

### `place_id` é a identidade primária da origem

O identificador duro de um estabelecimento descoberto é o `place_id`.
`cid` é armazenado como referência secundária. Nome, telefone, domínio e
endereço mudam e não formam uma chave estável.

A deduplicação segue esta ordem:

1. `place_id` já importado por este canal: conflito duro;
2. `place_id` já ligado em `lead_gbp_profiles`: conflito duro com o lead
   existente;
3. domínio já presente em `leads` ou `lead_digital_channels`: conflito duro;
4. telefone normalizado + empresa + cidade: possível duplicidade, exige decisão
   humana;
5. mesmo telefone em empresas diferentes: aviso, nunca bloqueio automático,
   porque franquias e centrais compartilham números.

### Lead sem site é permitido quando existe telefone

O modelo atual exige `website` e `website_domain` não nulos e usa domínio como
identidade. Isso excluiria empresas válidas que têm telefone e perfil no
Google, mas não possuem site.

O contrato passa a ser:

- `website` e `website_domain` são anuláveis;
- um lead precisa ter ao menos um meio de contato entre site e telefone;
- um candidato de prospecção também precisa de `place_id` verificado;
- a unicidade de domínio vale apenas quando o domínio existe;
- ausência de site aparece como `—`, nunca como URL inventada;
- auditorias que dependem de site exibem estado indisponível e não iniciam
  coleta;
- o cadastro manual aceita telefone sem site;
- a planilha mantém, nesta entrega, sua regra atual de site obrigatório. A
  mudança do contrato da planilha não é necessária para o novo canal e não é
  feita implicitamente.

Leads sem site precisam continuar editáveis. Portanto a validação compartilhada
do formulário de lead aceita telefone como alternativa, enquanto o schema
específico da planilha preserva sua exigência atual.

## Arquitetura

### Fluxo de dados

```text
segmento + cidade
        │
        ├── categorias salvas do segmento
        └── município IBGE → GeoJSON → círculo de cobertura
                         │
                         ▼
       Business Listings Search, até 1.000 por página
                         │
                         ▼
        normalização + geofence + relevância + deduplicação
                         │
                         ▼
              candidatos persistidos por execução
                         │
                    seleção humana
                         │
                         ▼
             Google Business Info por `place_id`
                         │
                         ▼
              confirmação de conflito e importação
                         │
                         ▼
                    lead na fila `new`
```

### Unidades

#### Catálogo de categorias

Responsável por baixar e interpretar a lista oficial, pesquisar nomes sem
depender de acentos, e manter o mapeamento segmento → categorias. O catálogo
guarda a data da versão publicada; o mapeamento guarda o nome da categoria, e
não uma posição na lista.

#### Fronteira municipal

Responsável por resolver código IBGE, armazenar GeoJSON, calcular círculo de
cobertura e classificar coordenadas. Funções geométricas ficam puras e sem
dependência de React, Supabase ou `server-only`.

#### Cliente Business Listings

Responsável somente pelo contrato DataForSEO: montar uma página, ler envelope,
normalizar custo e devolver paginação. Não decide relevância, cidade,
duplicidade nem importação.

#### Orquestrador da execução

Responsável por orçamento, lease de página, progresso, pausa, retomada e
persistência. Uma execução tem no máximo uma página em voo. Cada página é
idempotente por execução + cursor.

#### Normalizador de candidato

Responsável por transformar `business_listing` em campos do domínio. Ausência
fica `null`; nota ausente nunca vira zero. O payload integral do fornecedor não
é persistido no produto.

#### Importador

Responsável por revalidar o perfil, repetir a checagem de conflitos no momento
da escrita e criar lead + vínculo de origem numa operação coerente. Uma
importação em lote trata cada candidato separadamente: falha de um não desfaz
os leads já criados nem mascara os restantes.

## Modelo de dados

Os nomes abaixo fixam responsabilidades. Detalhes de índices e constraints são
especificados no plano depois da revisão desta spec.

### `prospecting_category_catalog`

- `category_name` — chave oficial, por exemplo `demolition_contractor`;
- `business_count` — contagem global informada pelo catálogo;
- `catalog_date`;
- `fetched_at`.

O refresh substitui a visão corrente do catálogo de modo transacional. Um
mapeamento já usado por uma execução continua preservado no snapshot da
execução mesmo que a categoria desapareça de uma versão futura.

### `prospecting_segment_categories`

- `segment_id`;
- `category_name`;
- `is_primary`;
- `created_by`;
- `created_at`.

Há no máximo dez categorias ativas por segmento e exatamente uma principal.

### `prospecting_city_boundaries`

- `state_code` e `city` canônicos;
- `ibge_code`;
- `geometry` GeoJSON;
- `center_latitude`, `center_longitude` e `radius_km`;
- `source_updated_at` quando fornecido;
- `fetched_at`.

Cidade + UF e código IBGE são únicos. GeoJSON inválido nunca é gravado.

### `prospecting_runs`

- segmento, cidade e UF;
- snapshot das categorias usadas;
- código IBGE, centro e raio usados;
- `status`: `draft`, `collecting`, `paused`, `completed`, `failed`,
  `cancelled`;
- `total_count`, `fetched_count`, `accepted_count`, `ambiguous_count` e
  `duplicate_count`, mais `rejected_count` para itens sem identidade;
- `next_offset` e `offset_token`;
- `page_limit`, fixado em 1.000;
- `budget_usd`, `estimated_cost_usd` e `actual_cost_usd`;
- lease da página em processamento;
- mensagem de erro sanitizada;
- usuário e timestamps.

Antes da confirmação, a execução fica em `draft`. `paused` carrega a razão
`user`, `budget` ou `vendor_price_change`, para a tela não tratar situações
diferentes como a mesma espera.

Categorias, área e `page_limit` ficam imutáveis depois da primeira chamada. É
o que permite reutilizar `offset_token` sem violar o contrato do fornecedor.

### `prospecting_candidates`

Entidade global por `place_id`:

- `place_id`, `cid` e `feature_id`;
- nome, descrição e categoria principal;
- IDs e categorias adicionais;
- endereço e endereço estruturado;
- telefone, site e domínio normalizados;
- latitude e longitude;
- nota e total de avaliações;
- perfil reivindicado;
- status de funcionamento;
- logo, imagem principal e total de fotos;
- URL de conferência;
- `vendor_first_seen`, `vendor_updated_at` e `last_verified_at`;
- `imported_lead_id` quando convertido;
- primeiro e último momento em que o Suite o encontrou.

O produto não persiste `popular_times`, `people_also_search`, serviços ou
atributos nesta entrega porque eles não participam da prospecção básica.

Item sem `place_id` não ganha identidade alternativa inventada: é contado como
rejeitado com razão `missing_identity` no recibo da página e não vira
candidato. `cid`, `feature_id`, nome ou telefone não são promovidos a chave
porque podem faltar, mudar ou ser compartilhados.

### `prospecting_run_pages`

Recibo de cada tentativa paga:

- `run_id` e chave derivada do cursor de entrada;
- `status`: `claimed`, `completed`, `failed` ou `unknown`;
- `offset`/`offset_token` de entrada e cursor de saída;
- quantidade recebida, normalizada e rejeitada;
- custo devolvido pelo envelope;
- lease, timestamps e erro sanitizado.

A chave impede duas chamadas simultâneas para o mesmo cursor. `unknown` cobre a
falha em que a conexão termina sem envelope: o fornecedor pode ter cobrado,
mas o Suite não inventa custo. A interface distingue custo confirmado de
tentativas com custo desconhecido.

### `prospecting_run_candidates`

Relação entre execução e candidato:

- `run_id` e `candidate_id`;
- posição de descoberta;
- classificação territorial: `inside`, `outside`, `ambiguous`;
- classificação de categoria: `exact`, `related`, `mismatch`;
- estado de revisão/importação;
- conflito detectado e lead relacionado;
- timestamps de seleção, rejeição e importação.

Uma empresa pode aparecer em várias pesquisas sem duplicar sua identidade. O
julgamento pertence à relação com a execução; os dados básicos pertencem ao
candidato global.

## Coleta e paginação

### Criação

Antes de qualquer chamada paga, a action:

1. exige integrante comercial autenticado;
2. valida segmento, cidade, UF e categorias;
3. resolve ou carrega a malha municipal;
4. carrega a tarifa da conta;
5. calcula o custo máximo de uma página;
6. exige orçamento suficiente para ao menos uma página;
7. grava a execução e devolve a confirmação de custo.

Confirmar inicia a primeira página. Não existe chamada paga em typeahead,
abertura de diálogo ou troca de campo.

### Página

Cada ciclo:

1. adquire lease atômica da execução;
2. verifica pausa, cancelamento e saldo do orçamento;
3. chama uma página do Business Listings;
4. acumula o custo real do envelope;
5. normaliza e faz upsert dos candidatos;
6. grava a relação e as classificações;
7. avança `offset`/`offset_token`;
8. libera a lease;
9. conclui quando não há próximo cursor, quando `fetched_count` alcança
   `total_count` ou quando o orçamento não comporta outra página.

O cliente faz polling somente enquanto a execução está coletando. Atualização
da tela não reinicia nem duplica uma página. Lease vencida pode ser retomada;
resposta repetida é absorvida pelas chaves idempotentes.

### Orçamento

O usuário autoriza simultaneamente:

- um teto em dólares;
- um teto de resultados a coletar.

O menor dos dois governa. A interface mostra estimativa, custo real, resultados
coletados e total declarado separadamente. `total_count` não é chamado de
“empresas da cidade”: inclui tudo no círculo antes do geofence.

Se a tarifa da conta não puder ser lida, a coleta paga não começa. Se o custo
real ultrapassar a estimativa dentro de uma chamada já autorizada, a execução
pausa antes da próxima página e informa a diferença.

## Classificação e qualidade

### Territorial

- `inside`: coordenada dentro do Polygon/MultiPolygon do IBGE;
- `outside`: coordenada fora;
- `ambiguous`: coordenada ausente ou inválida.

Somente `inside` é elegível para importação automática. `ambiguous` pode ser
selecionado para revalidação ao vivo; se a revalidação trouxer coordenada
interna, torna-se elegível. `outside` nunca é importado a partir daquela
execução.

### Categoria

- `exact`: a categoria principal do item pertence ao conjunto solicitado;
- `related`: uma categoria adicional do item pertence ao conjunto solicitado;
- `mismatch`: nenhuma categoria solicitada está presente.

`exact` e `related` são elegíveis e ficam visualmente distintos. `mismatch`
permanece para auditoria da qualidade do fornecedor e não é importável.

### Atualidade e contato

Na descoberta, `closed_forever` é inelegível. Antes da importação, o
`my_business_info/live` pode mudar o estado para:

- confirmado e importável;
- encerrado;
- não encontrado/desatualizado;
- sem meio de contato;
- conflito com lead existente.

Importável significa: `place_id`, território validado, categoria compatível,
não encerrado e pelo menos telefone ou site.

## Conversão em lead

Cada candidato selecionado passa por confirmação ao vivo imediatamente antes
da escrita. Os campos confirmados substituem os campos indexados no candidato.

O lead é criado com:

- nome da empresa;
- site e domínio, quando disponíveis;
- telefone, quando disponível;
- contato e e-mail nulos;
- segmento da execução;
- cidade e UF da execução, já validadas;
- status `new`;
- `assigned_sdr_id` nulo;
- vínculo do candidato em `imported_lead_id`.

A importação não dispara automaticamente a coleta completa da etapa Perfil no
Google, nem Q&A, avaliações e postagens. O `place_id` permanece disponível como
origem; a auditoria completa continua sendo uma ação própria do lead.

## Interface

### Navegação

“Prospecção” ganha rota própria `/prospecting` e item em `NAV_ITEMS`, perto de
“Leads”. O fluxo é longo, paginado e retomável; colocá-lo num diálogo do board
esconderia progresso e quebraria URLs compartilháveis.

O toolbar de Leads ganha uma ação secundária “Prospectar”, que navega para a
rota. Cadastro manual e importação de planilha continuam onde estão.

### Página de execuções

Segue o arquétipo operacional do Suite:

- cabeçalho de página com título e “Nova pesquisa”;
- toolbar fixa com busca e filtros;
- tabela de execuções com segmento, cidade, estado, progresso, custo, status e
  data;
- estado vazio: “Nenhuma pesquisa ainda. Crie uma pesquisa por segmento e
  cidade.”;
- paginação do banco, sem scroll horizontal da página.

### Nova pesquisa

Um `Dialog` resolve um objetivo: configurar a execução. Usa `Field` para:

- segmento pesquisável;
- categorias DataForSEO pesquisáveis e múltiplas;
- cidade pesquisável;
- limite de resultados;
- orçamento máximo.

A confirmação mostra a tarifa da conta, o custo máximo da primeira página e o
fato de que o total só será conhecido depois dela. CTA: “Iniciar pesquisa”.

### Detalhe da execução

A execução tem URL própria. O cabeçalho fica fora do scroll e mostra:

- segmento e cidade;
- estado da coleta;
- progresso coletado / total declarado, depois da primeira página;
- aceitos, ambíguos e duplicados;
- custo real / orçamento;
- ações “Pausar”, “Retomar” ou “Cancelar”, conforme o estado.

Antes de `total_count`, espera indeterminada usa `Spinner`. Depois, coleta sobre
total usa `Progress`, porque a fração passa a ser conhecida. Ausência de total
é `—`, nunca zero.

A lista é `Table`, pois os registros são comparados por colunas. Colunas:

- seleção;
- empresa;
- categoria;
- endereço/cidade;
- telefone;
- site;
- nota e avaliações;
- atualização do fornecedor;
- validação territorial;
- conflito/importação.

Filtros separam disponíveis, ambíguos, duplicados, importados e ignorados. A
seleção em massa nunca inclui linhas inelegíveis escondidas por filtro.

### Importação

“Importar selecionados” abre um `Dialog`, não `AlertDialog`: criar leads é uma
ação consequente, mas não destrutiva. O resumo separa elegíveis, bloqueados e
avisos. O progresso por candidato permanece visível; falhas ficam na linha para
nova tentativa.

Toda cor usa tokens semânticos, ícones vêm de `react-icons/ri`, controles usam
os tamanhos do registry e a página usa o gutter compartilhado. Não haverá
gráfico nem motion novo nesta entrega.

## Erros e estados explícitos

| Condição | Comportamento |
|---|---|
| DataForSEO não configurado | bloqueia criação e aponta Configurações → Ferramentas |
| tarifa indisponível | não inicia cobrança |
| categoria sem mapeamento | exige configurar antes da confirmação |
| malha municipal indisponível | não inicia cobrança |
| falha de página | execução fica `failed` com ação “Tentar novamente” |
| orçamento esgotado | pausa, preserva cursor e resultados |
| cursor repetido | upsert idempotente, sem duplicar contagem |
| candidato sem coordenada | `ambiguous`, revalidação permitida |
| candidato não encontrado ao vivo | `stale`, não importa |
| corrida com outro lead | rechecagem final transforma em conflito |
| importação parcial | mantém sucessos e lista falhas individualmente |

Mensagens não expõem credenciais, corpos crus nem textos internos do
fornecedor. Código e mensagem do fornecedor podem ir para log do servidor com
ID da execução, nunca para a interface integralmente.

## Segurança e acesso

- todas as actions exigem `requireCommercialMember()`;
- tabelas de prospecção têm RLS para integrantes comerciais autenticados;
- credenciais DataForSEO e consultas IBGE ficam no servidor;
- a interface nunca recebe payload bruto nem credenciais;
- limites de chamadas são aplicados no servidor;
- `created_by` registra quem autorizou o gasto e quem importou;
- dados públicos de empresas continuam restritos ao uso comercial interno e
  seguem a retenção do produto.

## Observabilidade

Cada execução registra:

- parâmetros imutáveis usados;
- total declarado pelo fornecedor;
- páginas iniciadas, concluídas e repetidas;
- itens recebidos, aceitos, ambíguos, externos e duplicados;
- custo estimado e real;
- última página concluída;
- código sanitizado da falha;
- tempos de criação, início, pausa, conclusão e cancelamento.

O painel de Ferramentas continua mostrando saldo e uso geral. A página de
prospecção mostra custo por execução e não tenta reconstruí-lo a partir de
preço de tabela.

## Sondagem antes dos mapeadores

Antes de implementar persistência definitiva do item, executar uma sondagem
paga e limitada com autorização de custo explícita. A amostra mínima é:

- `demolition_contractor` em São Paulo/SP;
- uma categoria abundante numa cidade média;
- uma categoria rara numa cidade pequena.

Para cada caso, guardar em `docs/auditoria/evidencias/` o corpo sanitizado da
requisição, resposta crua, custo e leitura humana de:

- `total_count` e comportamento do cursor;
- campos realmente presentes;
- distribuição dentro/fora do município;
- percentuais com telefone e site;
- itens sem coordenada ou `place_id`;
- duplicação entre páginas;
- idade de `last_updated_time`;
- correspondência real da categoria.

O objetivo da sondagem é corrigir o desenho contra payload real, como já foi
necessário na migração DataForSEO de 2026-09-15. A implementação não assume que
o exemplo da documentação contém todos os formatos encontrados no Brasil.

## Verificação e critérios de aceite

As regras do projeto proíbem comandos de teste, typecheck, build e lint. Esta
entrega não cria nem executa testes automatizados. A verificação é feita por
inspeção dirigida, sondagens controladas e roteiro manual documentado.

O canal está aceito quando:

1. uma pesquisa não faz chamada paga antes da confirmação de custo;
2. todas as páginas autorizadas podem ser retomadas sem duplicar candidatos;
3. o custo real exibido é a soma dos envelopes gravados;
4. 100% dos importados têm `place_id`, município validado e categoria
   compatível;
5. nenhum `closed_forever` é importado;
6. o mesmo `place_id` não gera dois leads;
7. domínio existente bloqueia a importação e aponta o lead correspondente;
8. lead sem site entra somente quando possui telefone;
9. lead sem site aparece corretamente no board, detalhe e estados de auditoria;
10. pausar, recarregar a página e retomar preserva cursor e seleção;
11. cancelamento impede novas chamadas e preserva o que já foi pago;
12. claro, escuro, teclado e viewport móvel mantêm leitura e operação;
13. uma amostra aleatória documentada de 50 candidatos de São Paulo atinge ao
    menos 95% dentro do município e 90% de aderência ao segmento entre os
    classificados como elegíveis.

Se a amostra não alcançar os dois limiares, a funcionalidade não é liberada
para importação em massa. Ela permanece em modo de revisão e o mapeamento de
categoria ou a regra territorial é corrigido.

## Ondas de entrega

1. **Sondagem:** payload real, cursores, custo, categoria e qualidade da base.
2. **Fundação:** catálogo, malha IBGE e funções de geometria.
3. **Persistência e coleta:** tabelas, RLS, cliente Business Listings, leases,
   orçamento e paginação.
4. **Candidatos:** normalização, geofence, relevância e conflitos.
5. **Lead sem site:** nulabilidade, validações, presenters e estados das
   auditorias dependentes de domínio.
6. **Importação:** revalidação ao vivo, conflito final e criação em lote.
7. **Interface:** navegação, lista de execuções, criação, detalhe, polling,
   seleção e importação.
8. **Verificação manual:** roteiro integral, amostra de precisão, claro/escuro,
   teclado, móvel e documentação operacional.

Cada onda deixa um resultado inspecionável e não inicia chamadas pagas fora da
sondagem ou de uma ação confirmada na interface.

## Não-escopo

- CNPJ, razão social, decisor, cargo, e-mail enriquecido ou confirmação de
  WhatsApp;
- disparo de campanhas, cadências ou mensagens;
- scoring comercial preditivo;
- busca por bairro;
- união automática com Google Maps SERP;
- coleta completa de Q&A, avaliações e postagens ao importar;
- alterar o formato da planilha atual para aceitar lead sem site;
- afirmar cobertura total do mercado real além da base e do orçamento
  consultados.

## Referências do repositório

- `lib/dataforseo/client.ts` — transporte, envelope e custo real;
- `lib/dataforseo/google-info.ts` — confirmação ao vivo por `place_id`;
- `lib/leads/gbp-business-info-map.ts` — tradução de perfil ao domínio;
- `lib/locationiq/city-center.ts` — centroide atual, insuficiente como fronteira;
- `lib/br-locations.ts` — nomes canônicos de cidade e UF;
- `app/actions/clients/research-serp.ts` — padrão de fila retomável;
- `app/actions/leads/create-lead.ts` — criação atual por domínio;
- `app/actions/leads/spreadsheet.ts` — importação atual, mantida com site;
- `lib/validations/lead.ts` — contrato atual que exige canal de website;
- `components/custom/LeadBoard/LeadBoardToolbar.tsx` — entrada para o novo canal;
- `components/custom/navigation.ts` — navegação e paleta compartilhadas.
