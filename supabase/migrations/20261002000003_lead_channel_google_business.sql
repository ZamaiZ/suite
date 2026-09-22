-- Canal "perfil no Google" para o lead que nao tem site.
--
-- Migration propria, e nao junto da anterior, por uma regra do Postgres: um
-- valor novo de enum nao pode ser USADO na mesma transacao em que e criado.
-- Juntar as duas faria a primeira insercao falhar com "unsafe use of new value
-- of enum type" -- e so em producao, porque um banco recem-criado aplica as
-- migrations em ordem e o erro depende de haver escrita no mesmo arquivo.
--
-- Com este valor, o lead sem site ganha um canal primario de verdade: o
-- `normalized_key` recebe o `place_id`, e o `unique (type, normalized_key)`
-- que `lead_digital_channels` ja tem passa a dedupar esses leads globalmente,
-- exatamente como o dominio deduplica quem tem site.
--
-- O `place_id` e a chave certa porque ja e unica global em
-- `lead_gbp_profiles.place_id`, e e o mesmo identificador que a prospeccao
-- traz do provedor -- entao promover duas vezes a mesma empresa esbarra na
-- constraint em vez de criar lead duplicado.

alter type public.lead_digital_channel_type add value if not exists 'google_business';
