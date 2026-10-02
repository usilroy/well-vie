import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Search,UserCircle,X} from 'lucide-react';
import {useMember} from './context';
import {BottomSheet} from './bottom-sheet';
import {ErrorBox,Loading} from './ui';
import {rpc,type ChatMember} from './data';
import {createCircle,saveMembership,memberPage,type MemberCandidate,type CircleDraft} from './circle-management-data';

export function CircleManagement({circleID,onClose,onSaved}:{circleID?:string;onClose:()=>void;onSaved:(id:string,stillMember:boolean)=>void}){
  const {db,profile}=useMember();
  const [name,setName]=useState(''),[description,setDescription]=useState('');
  const [members,setMembers]=useState<MemberCandidate[]>([]),[selected,setSelected]=useState(new Set<string>());
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),[loaded,setLoaded]=useState(false);
  const [loadingError,setLoadingError]=useState(false),[attempt,setAttempt]=useState(0);
  const [busy,setBusy]=useState(false),[saveError,setSaveError]=useState('');
  const confirmed=useRef(new Set<string>()),creation=useRef<CircleDraft|null>(null),saving=useRef(false);
  const id=useRef(crypto.randomUUID()),formID=useRef('circle-form-'+crypto.randomUUID());
  const alive=useRef(true),errorPanel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(saveError)errorPanel.current?.scrollIntoView({block:"nearest",behavior:"smooth"});},[saveError]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    if(!profile.is_admin)return;
    let active=true;setLoadingError(false);setLoaded(false);
    void Promise.all([rpc<MemberCandidate[]>(db,'circle_member_candidates'),circleID?rpc<ChatMember[]>(db,'circle_chat_members',{p_circle_id:circleID}):Promise.resolve([])])
      .then(([candidates,current])=>{
        if(!active)return;
        const combined=new Map(candidates.map(member=>[member.id,member]));
        for(const member of current)if(!combined.has(member.id))combined.set(member.id,member);
        if(!circleID&&!combined.has(profile.id))combined.set(profile.id,{id:profile.id,name:profile.name});
        setMembers([...combined.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)));
        const initial=new Set(circleID?current.map(member=>member.id):[profile.id]);
        confirmed.current=new Set(initial);setSelected(initial);setLoaded(true);
      }).catch(()=>{if(active)setLoadingError(true);});
    return()=>{active=false;};
  },[db,profile.id,profile.is_admin,circleID,attempt]);
  useEffect(()=>{
    const navigate=(event:Event)=>{if(saving.current)event.preventDefault();};
    const unload=(event:BeforeUnloadEvent)=>{if(saving.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('wellvie-before-navigate',navigate);window.addEventListener('beforeunload',unload);
    return()=>{window.removeEventListener('wellvie-before-navigate',navigate);window.removeEventListener('beforeunload',unload);};
  },[]);
  if(!profile.is_admin)return null;
  const visible=memberPage(members,search,page),locked=busy||!!creation.current;
  const valid=loaded&&selected.size<=256&&(!!circleID||(!!name.trim()&&name.length<=80&&description.length<=500));
  const save=async()=>{
    if(saving.current||!valid)return;
    saving.current=true;setBusy(true);setSaveError('');
    try{
      if(circleID)await saveMembership(db,circleID,confirmed.current,selected,profile.id);
      else{
        creation.current??={id:id.current,name:name.trim(),description:description.trim(),members:[...selected]};
        await createCircle(db,creation.current);
      }
      if(alive.current)onSaved(circleID??id.current,!circleID||selected.has(profile.id));
    }catch{
      if(alive.current)setSaveError(circleID?'Couldn’t save all changes. Your selections are kept. Try again to finish.':'Couldn’t confirm that the circle was created. Retry Save to check the same request.');
    }finally{saving.current=false;if(alive.current)setBusy(false);}
  };
  return <BottomSheet open onClose={onClose} title={circleID?'Manage members':'New circle'} dismissLabel="Cancel" canDismiss={!busy} className="circle-management-sheet"
    action={<button type="submit" form={formID.current} disabled={busy||!valid}>{busy?'Saving…':'Save'}</button>}>
    <form id={formID.current} className="circle-management-form" onSubmit={event=>{event.preventDefault();void save();}}>
      {saveError&&<div ref={errorPanel}><ErrorBox error={saveError}/></div>}
      {!circleID&&<fieldset disabled={locked}><legend>Circle details</legend><div className="circle-form-group">
        <label>Name<input autoComplete="off" value={name} maxLength={80} required onChange={event=>setName(event.target.value)}/></label>
        <label>Description (optional)<textarea rows={2} value={description} maxLength={500} onChange={event=>setDescription(event.target.value)}/></label>
      </div></fieldset>}
      <fieldset disabled={locked}><legend>Members</legend>
        <label className="circle-member-search"><Search size={18}/><input type="search" aria-label="Search members by name" placeholder="Search members by name" autoComplete="off" autoCapitalize="none" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/>{search&&<button type="button" className="icon-button" aria-label="Clear member search" onClick={()=>{setSearch('');setPage(0);}}><X size={18}/></button>}</label>
        {!loaded&&!loadingError?<Loading/>:loadingError?<ErrorBox error="Couldn’t load members." retry={()=>setAttempt(value=>value+1)}/>:<>
          <div className="circle-selection-summary" aria-live="polite"><span>{selected.size} selected</span>{visible.pages>1&&<span>{visible.range}</span>}</div>
          {visible.pages>1&&<nav className="circle-member-pages" aria-label="Member pages"><button type="button" aria-label="Previous members" disabled={visible.index===0} onClick={()=>setPage(visible.index-1)}><ChevronLeft size={20}/></button><span>Page {visible.index+1} of {visible.pages}</span><button type="button" aria-label="Next members" disabled={visible.index+1===visible.pages} onClick={()=>setPage(visible.index+1)}><ChevronRight size={20}/></button></nav>}
          {visible.items.length?<div className="circle-member-choices">{visible.items.map(member=><label key={member.id}><UserCircle size={24} aria-hidden="true"/><span>{member.name||'Circle member'}{member.id===profile.id&&<small>You{!circleID?' · included':''}</small>}</span><input type="checkbox" role="switch" checked={selected.has(member.id)} disabled={(!circleID&&member.id===profile.id)||(!selected.has(member.id)&&selected.size>=256)} onChange={event=>{const checked=event.target.checked;setSelected(current=>{const next=new Set(current);if(checked)next.add(member.id);else next.delete(member.id);return next;});}}/></label>)}</div>:<p className="small">{members.length?'No members match your search.':'No members available.'}</p>}
        </>}
        <p className="circle-member-note">Only selected members can open this circle and its earlier messages. Removing a member ends their access.{!circleID?' You’re included when you create a circle.':''}</p>
        {circleID&&loaded&&!selected.has(profile.id)&&<p className="circle-member-note">You’ll also leave this circle when you save.</p>}
      </fieldset>
    </form>
  </BottomSheet>;
}
