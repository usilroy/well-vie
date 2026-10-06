import {useRef,useState} from 'react';
import {Check,CalendarPlus} from 'lucide-react';
import type {DB,Gathering} from './data';
import {calendarText,downloadText} from './data';
import {responseStatus,rsvpError,rsvpLabels,saveRSVP,type RSVP,type RSVPStatus} from './rsvp-data';
import './rsvp.css';

export function RSVPControl({db,event,initial}:{db:DB;event:Gathering;initial:RSVP|null}) {
  const [response,setResponse]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),status=responseStatus(response,event.starts_at);
  const save=async(next:RSVPStatus|null)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{setResponse(await saveRSVP(db,event.id,event.starts_at,next));}
    catch(e){setError(rsvpError(e));}
    finally{lock.current=false;setBusy(false);}
  };
  return <section className="gathering-rsvp" aria-label={'RSVP for '+event.title} aria-busy={busy}>
    <div className="rsvp-heading"><strong>Will you be joining?</strong><span className="small" role="status">{busy?'Saving…':!error&&status!=='unanswered'&&status!=='needs_confirmation'?<><Check size={14}/>Response saved</>:null}</span></div>
    {status==='needs_confirmation'&&<p className="rsvp-reconfirm">The time has changed. Please RSVP again for this date.</p>}
    <div className="rsvp-options" role="group" aria-label="Your RSVP">{(['going','maybe','declined'] as const).map(value=><button key={value} type="button" disabled={busy} aria-pressed={status===value} onClick={()=>void save(value)}><span>{rsvpLabels[value]}</span></button>)}</div>
    <p className="rsvp-privacy">Only you and Well-Vie admins can see your response.</p>
    {error&&<p className="rsvp-error" role="alert">{error}</p>}
    {response&&<div className="rsvp-extra">{(status==='going'||status==='maybe')&&<button type="button" className="text-action" onClick={()=>downloadText('well-vie-gathering-'+event.id+'.ics',calendarText(event),'text/calendar')}><CalendarPlus size={16}/>Add to calendar</button>}<button type="button" className="text-action" disabled={busy} onClick={()=>void save(null)}>Clear response</button></div>}
  </section>;
}
