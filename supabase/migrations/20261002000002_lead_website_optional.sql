-- Site deixa de ser obrigatorio no lead.
--
-- Medido em 2026-09-21 contra o `business_listings`, em quatro cenarios
-- (docs/auditoria/evidencias/2026-09-21-prospeccao/): apenas 21% a 40% das
-- empresas de um segmento local tem site. Entre 45% e 60% NAO tem site MAS tem
-- telefone.
--
-- Para uma agencia de SEO e perfil no Google, esse e o lead mais quente que
-- existe -- e era exatamente o unico que a tabela recusava. `website` era
-- `not null` e `website_domain` era `not null unique`, entao a prospecao
-- entregaria tudo menos o que ela existe para entregar.
--
-- A unicidade continua valendo para quem TEM site: vira indice parcial. Dois
-- leads sem site nao colidem mais; antes colidiriam em '' -- veja o
-- `?? ""` que havia em `toLeadWritePayload`.
--
-- ATENCAO ao que muda junto, fora daqui: `app/actions/leads/spreadsheet.ts`
-- correlacionava os leads inseridos com seus canais por `website_domain` num
-- `Map`. Com a coluna anulavel, dois leads sem site colapsariam na mesma chave
-- e os canais de um iriam para o outro EM SILENCIO. A correlacao passou a ser
-- por id gerado no cliente, no mesmo commit desta migration.

alter table public.leads alter column website drop not null;
alter table public.leads alter column website_domain drop not null;

alter table public.leads drop constraint if exists leads_website_domain_key;

create unique index if not exists leads_website_domain_uidx
  on public.leads (website_domain)
  where website_domain is not null;

-- Os dois campos andam juntos ou faltam juntos. Mesmo espirito do
-- `leads_location_pair_chk`: meio par preenchido e sempre bug de escrita, e
-- descobrir isso na leitura custa mais caro.
alter table public.leads drop constraint if exists leads_website_pair_chk;
alter table public.leads add constraint leads_website_pair_chk
  check ((website is null) = (website_domain is null));
