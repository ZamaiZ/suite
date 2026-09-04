alter table public.client_briefing_secrets
  drop constraint if exists client_briefing_secrets_kind_chk;

alter table public.client_briefing_secrets
  add constraint client_briefing_secrets_kind_chk check (
    kind in ('wordpress', 'hosting_domain', 'domain')
    or kind like 'other:%'
  );
