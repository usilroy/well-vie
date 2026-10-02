import {useEffect} from 'react';
import {PenLine} from 'lucide-react';
import {useMember} from './context';
import {latestIntention} from './reflections-data';
import {useLoad} from './ui';

export function IntentionReminder(){
  const {db,profile,go}=useMember();
  const load=useLoad(()=>latestIntention(db,profile.id),[db,profile.id]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible')void load.reload();};
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('wellvie-reflection-changed',refresh);
    return()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('wellvie-reflection-changed',refresh);};
  },[load.reload]);
  return <button className="card intention-reminder" onClick={()=>go('/intention')} aria-label={load.data?'Change your current intention: '+load.data.text:'Set an intention'}>
    <span className="intention-card-copy"><span className="eyebrow">Today, I intend to…</span>
      <span className="intention-card-text">{load.data?.text??'Set an intention'}</span>
      <small>{load.loading?'Loading your intention…':load.error?'Open to set your intention':load.data?'Tap to change':'A small direction for today.'}</small>
    </span><PenLine size={20} aria-hidden="true"/>
  </button>;
}
