begin;

create table public.event_rsvps (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','maybe','declined')),
  event_starts_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create index event_rsvps_user_idx on public.event_rsvps(user_id);
alter table public.event_rsvps enable row level security;
revoke all on public.event_rsvps from public,anon,authenticated;
grant select on public.event_rsvps to authenticated;
grant all on public.event_rsvps to service_role;
create policy event_rsvps_read on public.event_rsvps for select to authenticated
using (public.is_current_member() and (public.is_admin() or (
  user_id=public.current_member_id() and exists(select 1 from public.events e where e.id=event_id and e.active)
)));

-- Only this RPC writes responses. The actor and timestamp come from the server;
-- members cannot submit for another person, retired events or a stale schedule.
create function public.set_event_rsvp(p_event_id bigint,p_status text,p_starts_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events%rowtype; v_response public.event_rsvps%rowtype;
begin
  if not public.is_current_member() then raise exception using errcode='42501',message='Membership is required.'; end if;
  if p_status is not null and p_status not in ('going','maybe','declined') then
    raise exception using errcode='22023',message='Choose a valid RSVP response.';
  end if;
  select * into v_event from public.events where id=p_event_id for share;
  if not found or not v_event.active then raise exception 'This gathering is no longer available.'; end if;
  if p_starts_at is null or v_event.starts_at<>p_starts_at then
    raise exception 'The gathering time changed. Refresh and RSVP for the new time.';
  end if;
  if now()>=v_event.starts_at+make_interval(mins=>coalesce(v_event.duration_min,60)+15) then
    raise exception 'RSVPs are closed for this gathering.';
  end if;
  if p_status is null then
    delete from public.event_rsvps where event_id=p_event_id and user_id=public.current_member_id();
    return null;
  end if;
  insert into public.event_rsvps(event_id,user_id,status,event_starts_at)
  values(p_event_id,public.current_member_id(),p_status,v_event.starts_at)
  on conflict(event_id,user_id) do update set status=excluded.status,
    event_starts_at=excluded.event_starts_at,updated_at=now()
  returning * into v_response;
  return to_jsonb(v_response);
end $$;
revoke all on function public.set_event_rsvp(bigint,text,timestamptz) from public,anon;
grant execute on function public.set_event_rsvp(bigint,text,timestamptz) to authenticated;

-- A private, paginated host view. No email addresses or wellbeing data are returned.
-- No reply includes current non-admin members; admins appear only if they RSVP.
create function public.admin_event_rsvps(p_event_id bigint,p_filter text default 'all',p_query text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_starts_at timestamptz; v_result jsonb;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Founder access is required.'; end if;
  if p_filter is null or p_filter not in ('all','going','maybe','declined','unanswered','needs_confirmation')
    or p_offset is null or p_offset<0 or length(coalesce(p_query,''))>200 then
    raise exception using errcode='22023',message='Invalid response filter.';
  end if;
  select starts_at into v_starts_at from public.events where id=p_event_id;
  if not found then raise exception 'This gathering no longer exists.'; end if;
  with members as materialized (
    select p.id as user_id,coalesce(nullif(btrim(p.name),''),'Member') as name,
      case when r.user_id is null then 'unanswered'
        when r.event_starts_at<>v_starts_at then 'needs_confirmation' else r.status end as status,
      r.updated_at
    from public.profiles p left join public.event_rsvps r on r.event_id=p_event_id and r.user_id=p.id
    where (not p.is_admin or r.user_id is not null)
      and not exists(select 1 from public.membership_revocations x where x.user_id=p.id)
      and not exists(select 1 from public.account_deletion_reservations x where x.user_id=p.id)
  ), filtered as (
    select * from members where (p_filter='all' or status=p_filter)
      and position(lower(btrim(coalesce(p_query,''))) in lower(name))>0
  ), page as (
    select * from filtered order by lower(name),user_id limit 20 offset p_offset
  )
  select jsonb_build_object(
    'counts',jsonb_build_object(
      'going',(select count(*) from members where status='going'),
      'maybe',(select count(*) from members where status='maybe'),
      'declined',(select count(*) from members where status='declined'),
      'unanswered',(select count(*) from members where status='unanswered'),
      'needs_confirmation',(select count(*) from members where status='needs_confirmation')
    ),
    'members',coalesce((select jsonb_agg(to_jsonb(page) order by lower(name),user_id) from page),'[]'::jsonb),
    'hasMore',(select count(*) from filtered)>p_offset+20
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.admin_event_rsvps(bigint,text,text,integer) from public,anon;
grant execute on function public.admin_event_rsvps(bigint,text,text,integer) to authenticated;
commit;
