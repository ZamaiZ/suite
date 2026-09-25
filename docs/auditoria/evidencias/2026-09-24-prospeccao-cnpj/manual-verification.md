# Revisão manual — enriquecimento de CNPJ

Data: 2026-09-24

## Fluxo inspecionado

- `app/actions/prospecting/cnpj.ts`: autenticação comercial, limite de 50 candidatos, configuração ausente, leitura apenas dos matches do lote próprio, validação estrutural novamente antes da confirmação e envio de somente `matchId` para a RPC.
- `lib/prospecting/cnpj-provider-adapter.ts`: credenciais apenas no servidor, SQL parametrizado, dry run antes da consulta, teto por lote e ID de job determinístico. Os erros retornados à interface não incluem credenciais nem resposta bruta.
- `supabase/migrations/20261007000000_prospecting_cnpj_enrichment.sql`: tabelas com RLS por autor, funções de escrita com autorização, validação CNPJ no banco, lock de candidatos e bloqueio de lotes ativos concorrentes, checagem do proprietário do lote também dentro da RPC de confirmação, transação de confirmação e cópia para lead apenas após confirmação.
- `components/custom/Prospecting/ProspectingRunPage.tsx`: lote começa por clique explícito; lote ativo apenas é consultado ao abrir e só avança após clique em iniciar/retomar; cada avanço termina antes do próximo timer; timer é cancelado ao desmontar/encerrar.
- `ProspectingCandidateTable.tsx` e `ProspectingCnpjReviewDialog.tsx`: estados distintos, dados originais do candidato, correspondências com fonte/data, e confirmação manual por resultado.
- `app/actions/leads/spreadsheet.ts`: inserção de planilha grava `cnpj: null`; cabeçalhos e validação da planilha não incluem CNPJ.
- Formulários de lead mantêm `cnpj` opcional separado de `tax_id`; o caminho de fechamento não foi alterado.

## Limites desta revisão

- Nenhum comando `git`, `typecheck`, `build`, `lint` ou `test` foi executado, conforme as instruções do projeto.
- A migration ainda não foi aplicada ao Supabase.
- Nenhuma credencial/projeto Google foi fornecido. Não houve dry run autenticado nem consulta BigQuery; o provedor retorna estado de não configurado até as duas variáveis obrigatórias existirem.
- Para cumprir a escolha por fonte gratuita, configurar um projeto BigQuery Sandbox sem conta de faturamento vinculada. O teto de bytes limita cada consulta, mas não é sozinho um teto mensal; o Sandbox deve bloquear a consulta quando a franquia gratuita acabar.
- Licença específica dos registros OpenCNPJ republicados no BigQuery e política de retenção não foram comprovadas separadamente. A evidência pública atual está em `README.md`; revisão jurídica/termos e medição real continuam pendentes antes de habilitação em produção.
- Por isso, não se afirma cobertura de todas as empresas, nem confirmação oficial pela Receita. O match exige avaliação humana e pode não localizar nomes divergentes, MEI ou filiais.

## Resultado

Revisão de código concluída; execução em ambiente e comportamento real do provedor permanecem pendentes de configuração e aplicação da migration.
