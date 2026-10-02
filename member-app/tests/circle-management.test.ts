import test from 'node:test';
import assert from 'node:assert/strict';
import {createCircle,saveMembership,memberPage,type CircleDraft} from '../src/circle-management-data.ts';
import type {DB} from '../src/data.ts';

test('Member search spans every page, ignores accents and clamps an old page index',()=>{
  const people=Array.from({length:29},(_,i)=>({id:String(i),name:`Member ${String(i).padStart(2,'0')}`}));
  people[27].name='Élodie';
  const first=memberPage(people,'',0),last=memberPage(people,'',2),found=memberPage(people,'  elodie ',2);
  assert.equal(first.items.length,12);assert.equal(first.range,'1 to 12 of 29');
  assert.equal(last.items.length,5);assert.equal(last.range,'25 to 29 of 29');
  assert.deepEqual(found.items,[people[27]]);assert.equal(found.index,0);
  assert.equal(memberPage(people,'absent',4).range,'0 members');
});

test('A lost create response retries the same circle and selection without duplicating it',async()=>{
  const stored=new Map<string,unknown>(),calls:unknown[]=[];let loseResponse=true;
  const db={rpc:async(_name:string,args:any)=>{calls.push(args);stored.set(args.p_id,args);if(loseResponse){loseResponse=false;return {data:null,error:new Error('Network response lost')};}return {data:args.p_id,error:null};}} as unknown as DB;
  const draft:CircleDraft={id:'fixed-id',name:'The Reset',description:'A private group',members:['me','a']};
  await assert.rejects(createCircle(db,draft));await createCircle(db,draft);
  assert.equal(stored.size,1);assert.deepEqual(calls[0],calls[1]);
  await assert.rejects(createCircle(db,{...draft,name:' '}));assert.equal(calls.length,2);
});

function membershipFixture(initial:string[]){
  const current=new Set(initial),calls:{id:string;add:boolean}[]=[];
  let failBefore='',loseAfter='';
  const db={rpc:async(name:string,args:any)=>{
    if(name==='circle_chat_members'){
      if(!current.has('me'))return {data:null,error:new Error('Membership required')};
      return {data:[...current].map(id=>({id,name:id})),error:null};
    }
    if(name==='list_my_circles')return {data:current.has('me')?[{id:'circle'}]:[],error:null};
    calls.push({id:args.p_user_id,add:args.p_add});
    if(failBefore===args.p_user_id){failBefore='';return {data:null,error:new Error('Offline')};}
    if(args.p_add)current.add(args.p_user_id);else current.delete(args.p_user_id);
    if(loseAfter===args.p_user_id){loseAfter='';return {data:null,error:new Error('Response lost')};}
    return {data:null,error:null};
  }} as unknown as DB;
  return {db,current,calls,failBefore:(id:string)=>{failBefore=id;},loseAfter:(id:string)=>{loseAfter=id;}};
}
test('Partial membership failure keeps completed removals and resumes additions safely',async()=>{
  const f=membershipFixture(['me','old','concurrent']);f.failBefore('new');
  const confirmed=new Set(['me','old']),selected=new Set(['me','new']);
  await assert.rejects(saveMembership(f.db,'circle',confirmed,selected,'me'));
  assert.deepEqual([...confirmed],['me']);assert.ok(!f.current.has('old'));
  await saveMembership(f.db,'circle',confirmed,selected,'me');
  assert.deepEqual([...f.current].sort(),['concurrent','me','new']);
  assert.equal(f.calls.filter(call=>call.id==='old').length,1);
});
test('A successful addition with a lost response is read back instead of added twice',async()=>{
  const f=membershipFixture(['me']);f.loseAfter('new');
  const confirmed=new Set(['me']),selected=new Set(['me','new']);
  await assert.rejects(saveMembership(f.db,'circle',confirmed,selected,'me'));
  await saveMembership(f.db,'circle',confirmed,selected,'me');
  assert.equal(f.calls.length,1);assert.ok(confirmed.has('new'));
});
test('Self removal runs last, and a lost acknowledgement is reconciled after access ends',async()=>{
  const f=membershipFixture(['me','old']);f.loseAfter('me');
  const confirmed=new Set(['me','old']),selected=new Set(['new']);
  await assert.rejects(saveMembership(f.db,'circle',confirmed,selected,'me'));
  assert.deepEqual(f.calls,[{id:'old',add:false},{id:'new',add:true},{id:'me',add:false}]);
  await saveMembership(f.db,'circle',confirmed,selected,'me');
  assert.deepEqual([...confirmed],['new']);assert.equal(f.calls.length,3);
});
