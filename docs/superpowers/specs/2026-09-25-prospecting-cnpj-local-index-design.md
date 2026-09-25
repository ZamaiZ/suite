# SUBSTITUÍDA — não usar para implementação atual

Esta proposta de índice SQLite foi substituída pela varredura nativa dos CSVs, aprovada em [2026-09-25-cnpj-local-csv-streaming-design.md](2026-09-25-cnpj-local-csv-streaming-design.md). Consulte essa especificação para o comportamento vigente.

# Índice local de CNPJ da Receita Federal

## Objetivo

Permitir enriquecer candidatos de prospecção usando localmente os arquivos de dados abertos da Receita Federal já baixados pelo usuário, sem BigQuery, API externa, hospedagem, Docker ou armazenamento da base em nuvem.

## Decisão de arquitetura

Manter intactos os arquivos fonte `Empresas0..9` e `Estabelecimentos0..9` na pasta local informada. Criar um índice persistente em disco contendo somente os campos necessários para busca e revisão. O app Suite, quando executado nesta mesma máquina, consulta o índice por meio de código server-side local; o navegador não lê diretamente os arquivos do Desktop.

A primeira preparação lê as partições em fluxo e cria o índice sem carregar a base inteira na RAM. Pesquisas seguintes usam o índice sem reprocessar os CSVs. O índice ocupa espaço adicional em disco; o primeiro piloto mede tempo e tamanho antes de construir a versão integral. A tecnologia do índice será decidida com base nesse piloto, considerando DuckDB como primeira opção para o volume e o formato da Receita.

## Alternativas consideradas

1. **Índice local, recomendado:** nenhum custo de hospedagem ou API; mantém os CSVs e adiciona um banco local. Só funciona quando o servidor do Suite tem acesso à pasta.
2. **Varredura dos CSVs por execução:** não cria cópia indexada, mas lê dezenas de GB novamente para cada prospecção e tende a ser mais lenta.
3. **Colab gratuito:** não usa disco local para a base, mas exige transferência manual por CSV, baixa a base novamente por execução e não oferece sessão confiável. Não é necessário se os CSVs e o app estiverem no mesmo computador.
4. **Índice em nuvem:** atende o app hospedado, mas requer armazenamento e computação pagos.

## Fluxo de preparação

1. Configurar a pasta raiz da base local sem fixar caminhos do Desktop no código. A pasta deve conter as dez partições de `Empresas` e as dez de `Estabelecimentos`.
2. Validar a presença, tamanho e competência dos arquivos; conferir amostras do delimitador, encoding, contagem de campos e layout contra a versão da base.
3. Fazer piloto com uma partição de `Estabelecimentos` e os arquivos necessários de `Empresas`, medindo duração, uso de RAM e crescimento do índice. O piloto não é tratado como indexação completa.
4. Antes da indexação integral, informar espaço livre e tamanho medido do piloto. Não começar se houver risco claro de encher o disco; não apagar nem alterar os CSVs originais.
5. Indexar as 20 partições por streaming, gravando temporariamente numa versão em construção. Só marcar o índice como pronto depois de todas as partições serem validadas e associadas à mesma competência.
6. Em falha ou falta de espaço, deixar o índice anterior intacto, registrar o motivo e permitir retomar ou descartar somente os artefatos temporários da indexação.
7. Guardar no índice a competência de origem e a data de criação. A atualização futura constrói uma versão nova e troca a ativa somente quando ela estiver íntegra.

## Dados e correspondência

- Indexar CNPJ básico, ordem da unidade e dígitos verificadores; razão social; nome fantasia; situação cadastral; UF e código do município; CEP; logradouro/número/bairro; telefones; CNAE principal e secundários.
- Usar os dados de `Empresas` e `Estabelecimentos` mantendo cada matriz/filial como estabelecimento próprio. Usar tabelas auxiliares oficiais disponíveis para traduzir códigos de município, situação e CNAE; quando não estiverem na pasta, baixar apenas as tabelas pequenas necessárias ou manter os códigos explicitamente rotulados.
- Normalizar acentos, pontuação e espaços apenas em colunas auxiliares de busca. Nunca alterar os dados fonte.
- Gerar candidatos de correspondência com nome legal/fantasia, telefone, CEP, UF, município e endereço. Nome parecido isoladamente não é suficiente para sugerir uma correspondência como confiável.
- Aplicar limiares conservadores. Conflitos ou sinais insuficientes permanecem `ambiguous`; `not_found` só é permitido após busca concluída no índice completo.
- CNAE é evidência de plausibilidade, não identificador. Validar sempre o dígito verificador do CNPJ.

## Fluxo de pesquisa na prospecção

1. A tela informa se a pasta está configurada, se o índice existe, a competência e o estado de preparação.
2. Se o índice não existir ou estiver desatualizado, a tela oferece preparar/atualizar a base com progresso por partição e erros legíveis.
3. Com o índice pronto, a ação de pesquisa envia somente os candidatos daquela execução à camada local de consulta.
4. Resultados são gravados no fluxo existente de sugestões de CNPJ com origem `Receita Federal — índice local`, URL pública oficial da fonte e competência consultada. A confirmação do CNPJ continua manual na revisão existente.
5. Candidatos sem correspondência confiável permanecem revisáveis; o app não preenche dados sem evidência.
6. Não enviar os CSVs da Receita ao Supabase. Persistir somente os resultados necessários da prospecção no banco já usado pelo Suite.

## Limite de execução

O código server-side local precisa rodar na mesma máquina que contém os arquivos. Uma versão do Suite hospedada em outro computador/servidor não consegue acessar caminhos locais do usuário. Se futuramente o app for hospedado, será necessário um agente local instalado ou uma infraestrutura de índice remoto; isso fica fora deste escopo.

O processo longo de indexação não deve depender de uma requisição web aberta até terminar. O desenho deve usar um processo local em segundo plano com progresso persistido em disco e consulta de estado pela UI. A implantação não requer Docker nem serviço externo.

## Privacidade, custo e armazenamento

- O processamento da base é local, sem envio dos arquivos cadastrais a terceiros.
- Não há custo de hospedagem nem chamada de API. Há custo de disco local para manter a base original e o índice, além de CPU e tempo de processamento.
- Não prometer tamanho final nem duração antes do piloto; estimar com partições reais e volume livre da máquina.
- A indexação não deve ocupar toda a RAM: leitura sequencial, lotes limitados e limites de concorrência.

## Escopo da implementação

- Criar um utilitário local de validação, piloto e indexação completa, reutilizado pela camada de consulta do Suite.
- Adicionar no fluxo de prospecção o estado do índice e uma ação para preparar/atualizar e pesquisar a base local.
- Persistir correspondências como sugestões revisáveis usando as tabelas e controles atuais, acrescentando a origem local com migration compatível.
- Manter o CSV de importação existente para compatibilidade com pesquisas históricas e revisões manuais.
- Remover configurações e dependências exclusivas de BigQuery ainda ativas; preservar a leitura de resultados históricos existentes.
- Não adicionar telemetria com caminhos locais, dados de empresas ou conteúdo dos CSVs.

## Critérios de aceite

1. A pasta raiz é configurável e os arquivos fonte não são modificados.
2. O piloto mede tempo e tamanho do índice sem exigir a leitura integral na RAM.
3. A indexação integral detecta arquivos ausentes, layout incorreto, competências divergentes e falta de espaço antes de ativar resultados parciais.
4. O Suite consulta o índice local e apresenta sugestões com evidência cadastral, sem confirmação automática.
5. O processo não depende de Google Colab, BigQuery, chaves de API, Docker ou hospedagem.
6. Se o app não puder acessar o caminho local, explica a limitação e não informa que o índice está pronto.

## Limitações conhecidas

- Construir o índice pode consumir vários GB adicionais; o valor depende do motor e dos campos/indexes selecionados.
- O primeiro processamento pode levar bastante tempo e depende do disco/CPU disponíveis.
- O caminho local só serve para um app executado na máquina que contém os arquivos.
- Nome fantasia, marca e razão social podem divergir; uma associação automatizada ainda requer evidências independentes para evitar falso positivo.
- A competência fornecida pelo usuário precisa ser verificada antes de a busca ser tratada como atual.
