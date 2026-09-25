# Pesquisa local de CNPJ nos CSVs da Receita

O Suite lê diretamente os 20 arquivos originais em streaming. Não constrói nem mantém um banco local duplicado. Cada pesquisa volta a ler a base, que ocupa cerca de 24 GB, por isso a duração depende do disco e da máquina. O servidor do Suite precisa rodar no computador que contém os arquivos.

## Configuração

No `.env.local`, configure a pasta que contém `Empresas0` a `Empresas9` e `Estabelecimentos0` a `Estabelecimentos9`, além de uma pasta de estado separada:

```dotenv
PROSPECTING_CNPJ_DATA_DIR="C:\\caminho\\para\\cnpj"
PROSPECTING_CNPJ_STATE_DIR="C:\\Users\\<usuário>\\AppData\\Local\\Suite\\cnpj-state"
PROSPECTING_CNPJ_LOCAL_ENABLED=false
```

Não coloque a pasta de estado dentro da pasta da Receita ou do repositório. A configuração legada `PROSPECTING_CNPJ_INDEX_DIR` continua aceita como destino de estado quando `PROSPECTING_CNPJ_STATE_DIR` não está definida. Em produção/self-hosted, a pesquisa permanece desativada até `PROSPECTING_CNPJ_LOCAL_ENABLED=true`.

## Pesquisa e armazenamento

1. A tela valida presença, competência, tamanho, data de modificação e layout das 20 partições.
2. Ao iniciar, os candidatos da prospecção atual são enviados pelo `stdin` do worker e não são gravados no disco.
3. O worker lê `Empresas` e `Estabelecimentos` em sequência, registra bytes/linhas lidos e aceita cancelamento cooperativo.
4. Quando a varredura termina e a base continua igual, somente os resultados limitados são escritos temporariamente na pasta de estado.
5. O Suite importa esses resultados em lotes no Supabase e os remove da pasta de estado após conclusão, cancelamento ou falha.

A tela mostra a pasta de estado, o arquivo atual, bytes e linhas lidos, candidatos processados, velocidade medida, eventos agregados e resultados. A estimativa de tempo só aparece após existir taxa observada. Matches continuam como sugestões revisáveis; a confirmação de CNPJ permanece manual.

## Cancelar e limpar

**Cancelar pesquisa** encerra a leitura cooperativamente. Durante o staging, a próxima etapa aborta o import temporário depois de terminar qualquer lote em andamento; durante o commit atômico, o Suite aguarda o resultado real.

**Limpar estado e eventos locais** remove apenas arquivos da pasta de estado do Suite e fica bloqueado enquanto houver execução ativa. Não há ação que apague ou altere os CSVs de origem.

**Apagar resultados locais desta prospecção** mostra antes as contagens de imports, lotes, tentativas, matches e CNPJs locais confirmados. A confirmação apaga apenas os registros `receita_local_index` daquela prospecção e limpa CNPJ confirmado somente quando ele aponta para um match local removido. Outras fontes e CSVs são preservados.

As pesquisas usam a competência da Receita como versão do conjunto de dados e mantêm os limites de correspondência do matcher. Resultados truncados ou conflitantes permanecem ambíguos. Para limitar memória em nomes muito genéricos, se uma empresa candidata corresponder a mais de 80 razões sociais, esse candidato fica ambíguo e exige revisão.
