alter table public.leads
  add column assigned_closer_id uuid references public.users(id) on delete set null,
  add column closing_meeting_at timestamptz;

alter table public.leads
  add constraint leads_opportunity_fields_chk check (
    (
      assigned_closer_id is null
      and closing_meeting_at is null
    )
    or (
      status = 'interested'
      and assigned_closer_id is not null
      and closing_meeting_at is not null
    )
  );

create index leads_assigned_closer_id_idx
  on public.leads (assigned_closer_id)
  where assigned_closer_id is not null;

create index leads_closing_meeting_at_idx
  on public.leads (closing_meeting_at)
  where closing_meeting_at is not null;

alter table public.lead_activities
  drop constraint lead_activities_type_fields_chk;

alter table public.lead_activities
  add constraint lead_activities_type_fields_chk check (
    (
      type = 'denied'
      and denied_reason is not null
      and length(trim(denied_reason)) > 0
    )
    or (
      type = 'call_later'
      and follow_up_at is not null
      and denied_reason is null
    )
    or (
      type = 'no_contact'
      and follow_up_at is null
      and denied_reason is null
    )
    or (
      type = 'interested'
      and denied_reason is null
    )
  );
