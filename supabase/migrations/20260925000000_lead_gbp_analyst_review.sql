-- Julgamento do analista sobre o perfil, estruturado.
--
-- Duas lacunas que nao se fecham com API: o tempo medio de resposta a
-- avaliacoes, porque a resposta do proprietario nao traz data no corpo (so a
-- data de quem avaliou), e a presenca em diretorios, que backlinks nao enxerga
-- porque so ve citacao com link.
--
-- Fica no perfil, e nao no snapshot, pelo mesmo motivo que `reputation_note`:
-- recoletar nao pode apagar nem duplicar julgamento de analista.
--
-- Jsonb e nao colunas soltas porque ja existe um terceiro campo humano
-- previsto por decisao registrada -- o sentimento de review -- e o padrao e o
-- mesmo de `lead_digital_presence_audits.review`.

alter table public.lead_gbp_profiles
  add column if not exists analyst_review jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.lead_gbp_profiles
    add constraint lead_gbp_profiles_analyst_review_obj_chk
    check (jsonb_typeof(analyst_review) = 'object') not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_profiles
  validate constraint lead_gbp_profiles_analyst_review_obj_chk;
