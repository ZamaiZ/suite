# Sondagem Business Listings — 2026-09-22

## Objetivo

Medir o contrato real de categorias, campos, paginação e custo do endpoint DataForSEO Business Listings antes de implementar os mapeadores do produto.

## Escopo autorizado

A sondagem faz uma chamada gratuita de categorias e exatamente duas chamadas pagas de busca com limit 2 para demolition_contractor, centro aproximado de São Paulo e raio de 45 km. A segunda chamada reutiliza offset_token quando presente; caso contrário usa offset + quantidade recebida.

## Segurança da evidência

O script carrega credenciais de .env.local apenas quando elas não estiverem no processo. Credenciais e headers nunca são impressos ou gravados. Os JSON preservam somente envelope/custo, paginação e os campos de negócio aprovados na spec.

## Execução

~~~powershell
node docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/probe-business-listings.mjs
~~~

O executável Node não estava disponível no PATH do shell de automação. A execução medida usa o probe PowerShell equivalente:

~~~powershell
powershell -ExecutionPolicy Bypass -File docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/probe-business-listings.ps1
~~~

## Resultado medido

- Captura: 2026-09-22T20:10:36Z a 2026-09-22T20:10:38Z.
- Versão do envelope: 0.1.20260917.
- demolition_contractor: 51.411 estabelecimentos no catálogo global.
- total_count no círculo de 45 km: 323.
- Primeira página: offset 0, count 2 e offset_token presente.
- Segunda página: offset 2, count 2 e novo offset_token presente.
- Custo confirmado: US$ 0,01272 por página, US$ 0,02544 nas duas páginas.
- Os quatro place_id são preenchidos e não se repetem entre páginas.
- O contrato usa count; items_count ficou ausente.
- A amostra provou a necessidade do geofence: os primeiros resultados incluem Poá e Caieiras, fora do município de São Paulo.

## Divergências e decisões

O catálogo medido retorna somente category_name e business_count; não retorna título localizado nem catalog_date. Esses campos permanecem nulos no domínio em vez de serem inventados. O offset_token também carrega o próximo offset, mas o produto o trata como opaco.

## Implementação produzida

O canal foi implementado em arquivos locais com:

- catálogo e mapeamento de categorias por segmento;
- fronteira municipal IBGE, círculo de busca e classificação por geofence;
- execução paginada com lease, cursor idempotente, teto de gasto e recibo por página;
- deduplicação, revisão e revalidação ao vivo antes da importação;
- lista de pesquisas, detalhe com polling serializado e importação sequencial;
- suporte a lead com telefone e sem website, sem relaxar a exigência da planilha.

As migrações ainda não foram aplicadas ao banco. Por isso, a inspeção estática está registrada, mas os cenários autenticados e de concorrência permanecem pendentes no roteiro manual. Não há alegação de liberação enquanto esses itens não forem preenchidos.

## Evidência complementar

O roteiro de liberação, consultas de conferência e campos de evidência estão em [manual-verification.md](./manual-verification.md).

## Limitações operacionais

- A cobertura representa a base Business Listings da DataForSEO, não um cadastro oficial completo.
- `total_count` descreve o círculo consultado antes do filtro pela fronteira municipal.
- A coleta avança enquanto a tela de detalhe permanece ativa; pausa e retomada preservam o cursor.
- Uma página `unknown` exige decisão humana antes de qualquer nova tentativa, pois o custo pode ter ocorrido.
- Categorias são exibidas a partir do identificador oficial em inglês enquanto não houver fonte localizada confiável.
