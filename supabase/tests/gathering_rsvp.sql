-- Run in the owner SQL console. All fixtures and responses are rolled back.
begin;
do $$
declare member_claims jsonb; admin_claims jsonb; member_id uuid; admin_id uuid;
  test_event_id bigint; starts timestamptz:=now()+interval '7 days'; rejected boolean; row_count integer; view_data jsonb;
begin
  select a.id,jsonb_build_object('sub',a.clerk_user_id,'role','authenticated','iss',c.issuer)
    into member_id,member_claims from public.member_accounts a cross join public.clerk_auth_configuration c
    where a.email='usilroy+wellvie-review@gmail.com' and a.enabled;
  select a.id,jsonb_build_object('sub',a.clerk_user_id,'role','authenticated','iss',c.issuer)
    into admin_id,admin_claims from public.member_accounts a cross join public.clerk_auth_configuration c
    where a.email='usilroy@gmail.com' and a.enabled;
  if member_claims is null or admin_claims is null then raise exception 'Review accounts unavailable'; end if;
  insert into public.events(title,starts_at,duration_min,active) values('RSVP transaction test',starts,60,true) returning id into test_event_id;
  perform set_config('request.jwt.claims',member_claims::text,true);set local role authenticated;
  if not public.is_current_member() or public.is_admin() then raise exception 'Expected ordinary member'; end if;
  perform public.set_event_rsvp(test_event_id,'going',starts);
  perform public.set_event_rsvp(test_event_id,'going',starts);
  select count(*) into row_count from public.event_rsvps r where r.event_id=test_event_id and r.user_id=member_id and r.status='going';
  if row_count<>1 then raise exception 'Repeat response not idempotent'; end if;
  perform public.set_event_rsvp(test_event_id,'maybe',starts);
  if not exists(select 1 from public.event_rsvps r where r.event_id=test_event_id and r.status='maybe') then raise exception 'Change not saved'; end if;
  rejected:=false;begin perform public.admin_event_rsvps(test_event_id);exception when insufficient_privilege then rejected:=true;end;
  if not rejected then raise exception 'Attendance exposed to member';end if;
  rejected:=false;begin perform public.set_event_rsvp(test_event_id,'invalid',starts);exception when invalid_parameter_value then rejected:=true;end;
  if not rejected then raise exception 'Invalid response accepted';end if;
  rejected:=false;begin insert into public.event_rsvps(event_id,user_id,status,event_starts_at) values(test_event_id,admin_id,'going',starts);exception when insufficient_privilege then rejected:=true;end;
  if not rejected then raise exception 'Direct spoofed write allowed';end if;
  reset role;perform set_config('request.jwt.claims',admin_claims::text,true);set local role authenticated;
  perform public.set_event_rsvp(test_event_id,'declined',starts);
  view_data:=public.admin_event_rsvps(test_event_id);
  if (view_data->'counts'->>'maybe')::int<>1 or (view_data->'counts'->>'declined')::int<>1 then raise exception 'Incorrect attendance counts';end if;
  if jsonb_array_length(view_data->'members')<>2 or (view_data->>'hasMore')::boolean then raise exception 'Nonresponders consumed attendance page slots';end if;
  if (view_data->'counts'->>'unanswered')::int<>0 then raise exception 'Nonresponders included in counts';end if;
  view_data:=public.admin_event_rsvps(test_event_id,'unanswered');
  if jsonb_array_length(view_data->'members')<>0 then raise exception 'Legacy no-reply filter exposed nonresponders';end if;
  view_data:=public.admin_event_rsvps(test_event_id,'maybe');
  if jsonb_array_length(view_data->'members')<>1 or view_data->'members'->0->>'user_id'<>member_id::text then raise exception 'Incorrect response filter';end if;
  view_data:=public.admin_event_rsvps(test_event_id,'all','',20);
  if jsonb_array_length(view_data->'members')>20 then raise exception 'Unbounded attendance';end if;
  reset role;perform set_config('request.jwt.claims',member_claims::text,true);set local role authenticated;
  if exists(select 1 from public.event_rsvps r where r.event_id=test_event_id and r.user_id=admin_id) then raise exception 'Other RSVP leaked';end if;
  reset role;update public.events set starts_at=starts+interval '1 day' where id=test_event_id;
  set local role authenticated;
  rejected:=false;begin perform public.set_event_rsvp(test_event_id,'going',starts);exception when others then rejected:=SQLERRM like 'The gathering time changed.%';end;
  if not rejected then raise exception 'Old schedule accepted';end if;
  reset role;perform set_config('request.jwt.claims',admin_claims::text,true);set local role authenticated;
  view_data:=public.admin_event_rsvps(test_event_id);
  if jsonb_array_length(view_data->'members')<>2 then raise exception 'Rescheduled responses missing';end if;
  if (view_data->'counts'->>'needs_confirmation')::int<>2 or (view_data->'counts'->>'maybe')::int<>0 then raise exception 'Reschedule not marked';end if;
  reset role;perform set_config('request.jwt.claims',member_claims::text,true);set local role authenticated;
  perform public.set_event_rsvp(test_event_id,'going',starts+interval '1 day');
  perform public.set_event_rsvp(test_event_id,null,starts+interval '1 day');
  if exists(select 1 from public.event_rsvps r where r.event_id=test_event_id) then raise exception 'Clear not saved';end if;
  reset role;update public.events set active=false where id=test_event_id;set local role authenticated;
  rejected:=false;begin perform public.set_event_rsvp(test_event_id,'going',starts+interval '1 day');exception when others then rejected:=SQLERRM='This gathering is no longer available.';end;
  if not rejected then raise exception 'Retired RSVP accepted';end if;
  reset role;update public.events set active=true,starts_at=now()-interval '1 day' where id=test_event_id;set local role authenticated;
  rejected:=false;begin perform public.set_event_rsvp(test_event_id,'going',now()-interval '1 day');exception when others then rejected:=SQLERRM='RSVPs are closed for this gathering.';end;
  if not rejected then raise exception 'Past RSVP accepted';end if;
  reset role;perform set_config('request.jwt.claims','{"sub":"user_noMembership","role":"authenticated","iss":"https://clerk.well-vie.com"}',true);set local role authenticated;
  if exists(select 1 from public.event_rsvps) then raise exception 'Nonmember read allowed';end if;
  rejected:=false;begin perform public.set_event_rsvp(test_event_id,'going',starts);exception when insufficient_privilege then rejected:=true;end;
  if not rejected then raise exception 'Nonmember write allowed';end if;
  reset role;
  if has_table_privilege('anon','public.event_rsvps','select') or has_function_privilege('anon','public.set_event_rsvp(bigint,text,timestamptz)','execute') then raise exception 'Anonymous access';end if;
end $$;
rollback;
select 'PASS: RSVP save/change/clear; private member and host access; reschedule reconfirmation; invalid, past, retired, nonmember and direct writes rejected. All test data rolled back.' as result;
