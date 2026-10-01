import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {latestIntention,completedAffirmations} from '../src/reflections-data.ts';

const member='00000000-0000-4000-8000-000000000001';
function client(respond:(url:URL)=>unknown){
  return createClient('https://reflections.example.invalid','public-test-key',{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async(input)=>new Response(JSON.stringify(respond(new URL(String(input)))),{headers:{'Content-Type':'application/json'}})},
  });
}
test('latest intention is scoped to the member and deterministically selects one record',async()=>{
  const db=client(url=>{
    assert.equal(url.pathname,'/rest/v1/intentions');
    assert.equal(url.searchParams.get('user_id'),'eq.'+member);
    assert.equal(url.searchParams.get('limit'),'1');
    assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');
    return [{id:3,text:'Make room for rest.',created_at:'2026-10-02T10:00:00Z'}];
  });
  assert.equal((await latestIntention(db,member))?.text,'Make room for rest.');
  assert.equal(await latestIntention(client(()=>[]),member),null);
});
test('affirmation history filters in the database and loads past the first page without collapsing repeated completions',async()=>{
  let requests=0;
  const db=client(url=>{
    requests++;
    assert.equal(url.pathname,'/rest/v1/practice_completions');
    assert.equal(url.searchParams.get('user_id'),'eq.'+member);
    assert.equal(url.searchParams.get('practices.need_slug'),'in.(affirmation,affirmations)');
    assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');
    assert.ok(url.searchParams.get('select')?.includes('practices!inner'));
    const offset=Number(url.searchParams.get('offset'));
    return Array.from({length:offset===0?500:1},(_,index)=>({id:501-offset-index,created_at:'2026-10-02T10:00:00Z',practices:{id:1,title:'Enough',body_text:'You are enough.',active:true}}));
  });
  const history=await completedAffirmations(db,member);
  assert.equal(requests,2);
  assert.equal(history.length,501);
  assert.equal(history.at(-1)?.id,1);
});
test('history errors are surfaced rather than shown as an empty history',async()=>{
  const db=createClient('https://reflections.example.invalid','public-test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>new Response(JSON.stringify({message:'Access denied',code:'42501'}),{status:403})}});
  await assert.rejects(completedAffirmations(db,member));
});
