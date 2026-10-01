import {Navigation,ChevronRight} from 'lucide-react';
import {useMember} from './context';
import {latestIntention} from './reflections-data';
import {useLoad,dateLabel,ErrorBox} from './ui';

export function IntentionReminder(){
  const {db,profile,go}=useMember();
  const load=useLoad(()=>latestIntention(db,profile.id),[db,profile.id]);
  if(load.error)return <ErrorBox error="Your saved intention couldn’t load." retry={load.reload}/>;
  if(!load.data)return null;
  return <aside className="card intention-reminder" aria-label="Your latest intention">
    <h2 className="reflection-heading"><Navigation size={15} aria-hidden="true"/>Your latest intention</h2>
    <p className="line-clamp">{load.data.text}</p>
    <div><small>{dateLabel(load.data.created_at)}</small><button className="text-action" onClick={()=>go('/history')}>View history<ChevronRight size={14}/></button></div>
  </aside>;
}
