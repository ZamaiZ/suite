create type public.lead_activity_channel as enum (
  'email',
  'call',
  'whatsapp',
  'other'
);

alter table public.lead_activities
  add column channel public.lead_activity_channel,
  add column channel_detail text;

alter table public.lead_activities
  add constraint lead_activities_channel_fields_chk check (
    (channel is null and channel_detail is null)
    or (channel <> 'other' and channel_detail is null)
    or (
      channel = 'other'
      and channel_detail is not null
      and length(trim(channel_detail)) > 0
    )
  );
