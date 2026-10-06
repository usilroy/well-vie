import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {BottomSheet} from '../bottom-sheet';
import {rsvpLabels,type AttendancePage,type ResponseStatus} from '../rsvp-data';
import {Alert,SearchField,message} from './shared';
import type {AdminRepository} from './types';
import '../rsvp.css';

export function Attendance({event,repository,onClose}:{event:{id:number;title:string};repository:AdminRepository;onClose:()=>void}) {
  const [counts,setCounts]=useState<AttendancePage['counts']>();
  const [data,setData]=useState<AttendancePage>(),[filter,setFilter]=useState<ResponseStatus|'all'>('all'),[query,setQuery]=useState('');
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const generation=useRef(0),lock=useRef(false);
  useEffect(()=>{
    const request=++generation.current;setData(undefined);setBusy(true);setError('');
    const timer=setTimeout(()=>{
      void repository.attendance(event.id,filter,query.trim(),0).then(next=>{if(request===generation.current){setData(next);setCounts(next.counts);}})
        .catch(e=>{if(request===generation.current)setError(message(e));})
        .finally(()=>{if(request===generation.current)setBusy(false);});
    },query?250:0);
    return()=>{clearTimeout(timer);generation.current++;};
  },[event.id,repository,filter,query,refresh]);
  const more=async()=>{
    if(lock.current||busy||!data)return;lock.current=true;setBusy(true);setError('');const request=generation.current;
    try{const next=await repository.attendance(event.id,filter,query.trim(),data.members.length);if(request===generation.current){setData({...next,members:[...data.members,...next.members.filter(m=>!data.members.some(old=>old.user_id===m.user_id))]});setCounts(next.counts);}}
    catch(e){if(request===generation.current)setError(message(e));}
    finally{lock.current=false;if(request===generation.current)setBusy(false);}
  };
  const responses=data?.members.filter(m=>m.status!=='unanswered');
  return <BottomSheet open title="Gathering RSVPs" className="attendance-sheet" onClose={onClose}><div className="rsvp-attendance">
    <div className="row"><h3 className="grow">{event.title}</h3><button className="icon-button" aria-label="Refresh responses" disabled={busy} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={18}/></button></div>
    <div className="attendance-filters" role="group" aria-label="Filter RSVP responses">{(['all','going','maybe','declined','needs_confirmation'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?'All responses':rsvpLabels[value]}{counts&&value!=='all'?' · '+counts[value]:''}</button>)}</div>
    <SearchField label="Search members" value={query} onChange={value=>setQuery(value.slice(0,200))}/>
    {counts&&<p className="attendance-summary">{counts.going} going · {counts.maybe} maybe · {counts.declined} can’t make it{counts.needs_confirmation>0?' · '+counts.needs_confirmation+' to confirm again':''}</p>}
    {filter==='needs_confirmation'&&<p className="small">These members responded before the call time changed.</p>}
    <Alert error={error}/>{error&&<button className="outline" disabled={busy} onClick={()=>data?void more():setRefresh(v=>v+1)}>Try again</button>}
    <div aria-busy={busy}>{responses?.map(m=><div className="attendance-person" key={m.user_id}><strong>{m.name}</strong><span data-status={m.status}>{rsvpLabels[m.status]}</span></div>)}{responses&&!responses.length&&<p className="muted">{filter==='all'&&!query?'No responses yet.':'No responses match this filter.'}</p>}</div>
    {busy&&<p className="small" role="status">Loading responses…</p>}
    {data?.hasMore&&!error&&<button className="outline" disabled={busy} onClick={()=>void more()}>Load more</button>}
  </div></BottomSheet>;
}
