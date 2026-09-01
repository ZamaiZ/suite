alter type public.lead_status add value if not exists 'converted';

alter type public.lead_activity_type add value if not exists 'meeting_rescheduled';
alter type public.lead_activity_type add value if not exists 'meeting_no_show';
alter type public.lead_activity_type add value if not exists 'closing_standby';
alter type public.lead_activity_type add value if not exists 'closing_lost';
alter type public.lead_activity_type add value if not exists 'closing_won';
