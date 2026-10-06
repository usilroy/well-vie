begin;

-- Additive: existing native clients continue to use replay_url/call_replay_url.
create table public.replay_assets (
  id uuid primary key,
  target_table text not null check (target_table in ('events','program_weeks')),
  target_id bigint not null,
  title text not null,
  storage_path text not null unique,
  duration_sec integer not null check (duration_sec between 1 and 21600),
  created_at timestamptz not null default now()
);
alter table public.replay_assets enable row level security;
revoke all on public.replay_assets from anon, authenticated;
grant select on public.replay_assets to authenticated;
grant all on public.replay_assets to service_role;

create function public.replay_is_available(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_current_member() and exists (
    select 1 from public.replay_assets r
    where r.id = p_id and (
      (r.target_table = 'events' and exists (
        select 1 from public.events e where e.id = r.target_id and e.active
        and e.replay_url = 'https://www.well-vie.com/app/?replay=' || r.id::text
      )) or (r.target_table = 'program_weeks' and exists (
        select 1 from public.program_weeks w where w.id = r.target_id
        and w.call_replay_url = 'https://www.well-vie.com/app/?replay=' || r.id::text
      ))
    )
  );
$$;
revoke all on function public.replay_is_available(uuid) from public, anon;
grant execute on function public.replay_is_available(uuid) to authenticated;
create policy replay_assets_read on public.replay_assets for select to authenticated
using (public.is_admin() or public.replay_is_available(id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('replay-videos','replay-videos',false,500000000,array['video/mp4']);
create policy replay_video_read on storage.objects for select to authenticated
using (bucket_id='replay-videos' and (
  public.is_admin() or exists(select 1 from public.replay_assets r
    where r.storage_path=storage.objects.name and public.replay_is_available(r.id))
));
create policy replay_video_upload on storage.objects for insert to authenticated
with check (bucket_id='replay-videos' and public.is_admin()
  and name ~ '^replays/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp4$');
-- No overwrite or delete policy: uploads are immutable, and drafts/orphans stay private.

create function public.attach_replay(
  p_id uuid, p_target_table text, p_target_id bigint,
  p_expected_revision bigint, p_duration_sec integer
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_path text := 'replays/' || p_id::text || '.mp4';
  v_url text := 'https://www.well-vie.com/app/?replay=' || p_id::text;
  v_title text; v_revision bigint; v_current_url text; v_existing public.replay_assets%rowtype;
begin
  if not public.is_admin() then raise exception 'Founder access is required.'; end if;
  if p_duration_sec is null or p_duration_sec not between 1 and 21600 then
    raise exception 'The replay duration is invalid.';
  end if;
  if p_target_table='events' then
    select title,revision,replay_url into v_title,v_revision,v_current_url
    from public.events where id=p_target_id for update;
  elsif p_target_table='program_weeks' then
    select title,revision,call_replay_url into v_title,v_revision,v_current_url
    from public.program_weeks where id=p_target_id for update;
  else raise exception 'Unknown replay destination.';
  end if;
  if v_revision is null then raise exception 'The replay destination no longer exists.'; end if;
  select * into v_existing from public.replay_assets where id=p_id;
  if found then
    if v_existing.target_table=p_target_table and v_existing.target_id=p_target_id
      and v_existing.duration_sec=p_duration_sec and v_current_url=v_url then return;
    end if;
    raise exception 'This upload belongs to another or newer edit. Refresh and try again.';
  end if;
  if v_revision <> p_expected_revision or p_expected_revision is null then
    raise exception 'This record changed while you were editing. Refresh before attaching the replay.';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='replay-videos' and name=v_path
    and metadata->>'mimetype'='video/mp4'
    and (metadata->>'size')::bigint between 1 and 500000000) then
    raise exception 'The video upload is incomplete or invalid. Retry the upload.';
  end if;
  insert into public.replay_assets(id,target_table,target_id,title,storage_path,duration_sec)
  values(p_id,p_target_table,p_target_id,v_title,v_path,p_duration_sec);
  if p_target_table='events' then
    update public.events set replay_url=v_url where id=p_target_id;
  else
    update public.program_weeks set call_replay_url=v_url where id=p_target_id;
  end if;
end;
$$;
revoke all on function public.attach_replay(uuid,text,bigint,bigint,integer) from public,anon;
grant execute on function public.attach_replay(uuid,text,bigint,bigint,integer) to authenticated;
commit;
