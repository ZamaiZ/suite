update public.leads as lead
set phone = canonical.phone
from (
  select
    id,
    case
      when length(digits) = 0 then null
      when length(digits) in (10, 11) then '55' || digits
      when length(digits) in (12, 13) and digits like '55%' then digits
      else digits
    end as phone
  from (
    select
      id,
      regexp_replace(phone, '[^0-9]', '', 'g') as digits
    from public.leads
    where phone is not null
  ) as stripped
) as canonical
where lead.id = canonical.id;
