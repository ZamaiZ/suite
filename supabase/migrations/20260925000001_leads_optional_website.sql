alter table public.leads
  drop constraint if exists leads_website_domain_key,
  alter column website drop not null,
  alter column website_domain drop not null;

update public.leads
set
  website = nullif(btrim(website), ''),
  website_domain = nullif(btrim(website_domain), ''),
  phone = nullif(btrim(phone), '')
where btrim(website) = ''
   or btrim(website_domain) = ''
   or btrim(phone) = '';

create unique index if not exists leads_website_domain_uidx
  on public.leads(website_domain)
  where website_domain is not null;

alter table public.leads
  add constraint leads_contact_channel_check
  check (
    website_domain is not null
    or nullif(btrim(phone), '') is not null
  );
