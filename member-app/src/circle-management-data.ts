import {rpc,type DB,type ChatMember,type Circle} from './data.ts';

export type MemberCandidate={id:string;name:string};
export type CircleDraft={id:string;name:string;description:string;members:string[]};
export const memberPageSize=12;
const searchable=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase();
export function memberPage(members:MemberCandidate[],search:string,page:number){
  const query=searchable(search.trim());
  const matches=members.filter(member=>searchable(member.name).includes(query));
  const pages=Math.max(1,Math.ceil(matches.length/memberPageSize));
  const index=Math.min(Math.max(0,page),pages-1),start=index*memberPageSize;
  return {items:matches.slice(start,start+memberPageSize),index,pages,total:matches.length,
    range:matches.length?`${start+1} to ${Math.min(start+memberPageSize,matches.length)} of ${matches.length}`:'0 members'};
}
export async function createCircle(db:DB,draft:CircleDraft){
  if(!draft.name.trim()||draft.name.length>80||draft.description.length>500||draft.members.length>256)throw new Error('Please enter a circle name and choose up to 256 members.');
  return rpc<string>(db,'admin_create_circle',{p_id:draft.id,p_name:draft.name.trim(),p_description:draft.description.trim(),p_members:draft.members});
}
// `confirmed` advances after each acknowledged or reconciled change. A lost
// response is reconciled before retry, while unrelated concurrent changes stay intact.
export async function saveMembership(db:DB,circleID:string,confirmed:Set<string>,selected:Set<string>,actorID:string){
  const removals=[...confirmed].filter(id=>!selected.has(id));
  const additions=[...selected].filter(id=>!confirmed.has(id));
  let current:Set<string>;
  try{current=new Set((await rpc<ChatMember[]>(db,'circle_chat_members',{p_circle_id:circleID})).map(member=>member.id));}
  catch(error){
    // Removing yourself is always last. Its response can be lost after access ends.
    if(removals.length===1&&removals[0]===actorID&&!additions.length){
      const circles=await rpc<Circle[]>(db,'list_my_circles');
      if(!circles.some(circle=>circle.id===circleID)){confirmed.delete(actorID);return;}
    }
    throw error;
  }
  const changes=[...removals.filter(id=>id!==actorID).map(id=>({id,add:false})),
    ...additions.map(id=>({id,add:true})),...removals.filter(id=>id===actorID).map(id=>({id,add:false}))];
  for(const {id,add} of changes){
    if(current.has(id)!==add)await rpc(db,'admin_circle_membership',{p_circle_id:circleID,p_user_id:id,p_add:add});
    if(add){current.add(id);confirmed.add(id);}else{current.delete(id);confirmed.delete(id);}
  }
}
