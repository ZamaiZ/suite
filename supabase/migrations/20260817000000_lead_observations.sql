alter table public.leads
  add column observations text;

alter table public.leads
  add constraint leads_observations_len_chk
  check (observations is null or char_length(observations) <= 2000);
