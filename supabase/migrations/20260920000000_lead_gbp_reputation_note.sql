-- Leitura humana da reputação: sentimento das avaliações, temas recorrentes e
-- o que os números não contam.
--
-- Fica em lead_gbp_profiles, ao lado de notes, pelo mesmo motivo que a revisão
-- do site saiu do snapshot na onda anterior: julgamento do analista pertence à
-- entidade estável, não à coleta. Uma nova coleta não deve apagá-lo nem
-- duplicá-lo por snapshot.

alter table public.lead_gbp_profiles
  add column if not exists reputation_note text;

do $$
begin
  alter table public.lead_gbp_profiles
    add constraint lead_gbp_profiles_reputation_note_len_chk
    check (
      reputation_note is null
      or char_length(trim(reputation_note)) between 1 and 2000
    ) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_profiles
  validate constraint lead_gbp_profiles_reputation_note_len_chk;
