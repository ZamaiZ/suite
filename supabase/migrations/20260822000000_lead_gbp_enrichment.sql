alter table public.lead_gbp_profiles
  add column cid text,
  add column enrichment jsonb,
  add column enrichment_at timestamptz;

alter table public.lead_gbp_profiles
  add constraint lead_gbp_profiles_cid_len_chk
    check (
      cid is null
      or char_length(trim(cid)) between 1 and 64
    ),
  add constraint lead_gbp_profiles_enrichment_at_chk
    check ((enrichment is null) = (enrichment_at is null));
