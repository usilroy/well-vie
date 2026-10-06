import test from 'node:test';
import assert from 'node:assert/strict';
import {responseStatus,saveRSVP,rsvpError,type RSVP} from '../src/rsvp-data.ts';
import type {DB} from '../src/data.ts';
const response:RSVP={event_id:2,status:'going',event_starts_at:'2026-10-08T17:00:00Z',updated_at:'2026-10-06T12:00:00Z'};
test('RSVP is for the actual instant, irrespective of the member’s time zone',()=>{
  assert.equal(responseStatus(response,'2026-10-08T19:00:00+02:00'),'going');
  assert.equal(responseStatus(response,'2026-10-09T17:00:00Z'),'needs_confirmation');
  assert.equal(responseStatus(null,response.event_starts_at),'unanswered');
});
test('save and clear send the viewed date but never a client-selected member identity',async()=>{
  const calls:unknown[]=[];
  const db={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:args.p_status?{...response,status:args.p_status}:null,error:null};}} as unknown as DB;
  assert.equal((await saveRSVP(db,2,response.event_starts_at,'maybe'))?.status,'maybe');
  assert.equal(await saveRSVP(db,2,response.event_starts_at,null),null);
  assert.deepEqual(calls,[{name:'set_event_rsvp',args:{p_event_id:2,p_status:'maybe',p_starts_at:response.event_starts_at}},{name:'set_event_rsvp',args:{p_event_id:2,p_status:null,p_starts_at:response.event_starts_at}}]);
});
test('a failed save never produces a successful response or hides a date conflict',async()=>{
  const error={message:'The gathering time changed. Refresh and RSVP for the new time.'};
  const db={rpc:async()=>({data:null,error})} as unknown as DB;
  await assert.rejects(saveRSVP(db,2,response.event_starts_at,'going'),e=>e===error);
  assert.equal(rsvpError(error),error.message);
  assert.match(rsvpError(new Error('Failed to fetch')),/could not be saved/);
});
