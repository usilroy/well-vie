-- Host attendance includes only saved responses. Keep the legacy unanswered
-- filter/count in the RPC contract for installed clients, returning empty/zero.
-- Filter before pagination so nonresponders cannot consume response page slots.
begin;
create or replace function public.admin_event_rsvps(p_event_id bigint,p_filter text default 'all',p_query text default '',p_offset integer default 0)
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
      case when r.event_starts_at<>v_starts_at then 'needs_confirmation' else r.status end as status,
      r.updated_at
    from public.profiles p join public.event_rsvps r on r.event_id=p_event_id and r.user_id=p.id
    where not exists(select 1 from public.membership_revocations x where x.user_id=p.id)
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
      'unanswered',0,
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
