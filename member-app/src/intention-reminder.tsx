import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Leaf,PenLine} from 'lucide-react';
import {useMember} from './context';
import {latestIntention} from './reflections-data';
import {isTodaysIntention} from './daily-intention';
import {useLocalDay} from './use-local-day';
import {useLoad} from './ui';

export function IntentionReminder(){
  const {db,profile,go}=useMember();
  const load=useLoad(()=>latestIntention(db,profile.id),[db,profile.id]);
  const now=useLocalDay();
  const current=load.data&&isTodaysIntention(load.data.created_at,now)?load.data:null;
  const textRef=useRef<HTMLSpanElement>(null);
  const [textHeight,setTextHeight]=useState(48);
  useLayoutEffect(()=>{
    const text=textRef.current;
    if(!text)return;
    const measure=()=>setTextHeight(text.getBoundingClientRect().height);
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(text);
    return()=>observer.disconnect();
  },[current?.text]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible')void load.reload();};
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('wellvie-reflection-changed',refresh);
    return()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('wellvie-reflection-changed',refresh);};
  },[load.reload]);
  const waiting=load.loading&&load.data===undefined;
  return <button className="card intention-reminder" aria-busy={waiting} onClick={()=>go('/intention')} aria-label={current?'Change your current intention: '+current.text:'Set your intention for today'}>
    <span className="intention-card-copy"><span className="eyebrow">Today, I intend to…</span>
      <span className="intention-card-slot" data-loading={waiting} style={{height:waiting?48:textHeight}}>
        <span className="intention-card-text" ref={textRef}>{current?.text??'Set your intention for today'}</span>
        <span className="intention-card-placeholder" aria-hidden="true"><span className="wellvie-loading-leaf"><Leaf size={25} strokeWidth={1.5}/></span></span>
      </span>
    </span><PenLine size={20} aria-hidden="true"/>
  </button>;
}
