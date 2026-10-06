import {confirmNavigation} from './confirm-dialog';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,CheckCircle,Leaf,Navigation2} from 'lucide-react';
import {useMember} from './context';
import {IntentionSuggestions} from './intention-suggestions';
import {allRows,cleanCopy,practiceColumns,result,rpc,type Practice} from './data';
import {AudioHalo,balancedTitle} from './audio-halo';
import {ErrorBox,Loading,Page,useAction,useLoad} from './ui';

function streak(dates:string[]){const key=(date:Date)=>`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;const days=new Set(dates.map(date=>key(new Date(date))));const cursor=new Date();if(!days.has(key(cursor)))cursor.setDate(cursor.getDate()-1);let count=0;while(days.has(key(cursor))){count++;cursor.setDate(cursor.getDate()-1);}return count;}

export function PracticeView({id,initiallyComplete=false}:{id:number;initiallyComplete?:boolean}){
  const {db,go,play,playing,paused,pause,stop,playbackEventID,completedPracticeID}=useMember();
  const load=useLoad(()=>result<Practice|null>(db.from('practices').select(practiceColumns).eq('id',id).eq('active',true).maybeSingle()),[db,id]);
  const [finished,setFinished]=useState(initiallyComplete),finishedRef=useRef(initiallyComplete);
  const [sync,setSync]=useState<'idle'|'saving'|'saved'|'failed'>('idle');
  const eventID=useRef(crypto.randomUUID()),completionID=useRef<string>(eventID.current),action=useAction();
  const saveCompletion=async()=>{setSync('saving');try{await rpc(db,'record_practice_completion',{p_event_id:completionID.current,p_practice_id:id});setSync('saved');}catch{setSync('failed');}};
  const finish=()=>{if(finishedRef.current)return;finishedRef.current=true;completionID.current=playing?.id===id?playbackEventID:eventID.current;if(playing?.id===id)stop();setFinished(true);window.scrollTo(0,0);void saveCompletion();};
  useEffect(()=>{if(completedPracticeID===id&&playing?.id===id)finish();},[completedPracticeID,id,playing?.id]);
  if(load.loading)return <Loading/>;
  if(load.error)return <ErrorBox error={load.error} retry={load.reload}/>;
  const practice=load.data;if(!practice)return <Page title="Practice unavailable" intro="This practice is no longer available."/>;
  if(finished)return <GentleClose practice={practice} sync={sync} retry={()=>void saveCompletion()}/>;
  if(practice.kind==='text')return <Page eyebrow={practice.need_slug.replaceAll('-',' ')} title={practice.title} intro={practice.description}><div className="practice-body card"><p className="pre-wrap">{cleanCopy(practice.body_text).split('\n\n').filter(t=>t.trim()&&t.trim().toLowerCase()!==practice.title.trim().toLowerCase()).join('\n\n')}</p></div><button className="primary full-width" onClick={finish}><Leaf size={19}/>I’ve taken this in</button></Page>;
  const isPlaying=playing?.id===id&&!paused;
  return <section className="audio-practice"><header className="audio-practice-copy calm-enter"><div className="eyebrow">{practice.need_slug.replaceAll('-',' ')}</div><h1>{balancedTitle(cleanCopy(practice.title))}</h1><p>{cleanCopy(practice.description)}</p></header><AudioHalo seed={id} title={practice.title} playing={isPlaying} loading={action.busy} onToggle={()=>{if(isPlaying)pause();else void action.run(()=>play(practice));}}/><p className="audio-duration calm-enter" style={{animationDelay:'130ms'}}>{practice.duration_sec?`${Math.max(1,Math.round(practice.duration_sec/60))} minute guided audio`:'Guided audio'}</p>{action.error&&<ErrorBox error={action.error}/>}<button className="practice-finish calm-enter" style={{animationDelay:'195ms'}} onClick={finish}>I’m finished</button></section>;
}

function GentleClose({practice,sync,retry}:{practice:Practice;sync:'idle'|'saving'|'saved'|'failed';retry:()=>void}){
  const {db,go}=useMember();const [phase,setPhase]=useState<'choices'|'intention'|'saved'>('choices'),[text,setText]=useState('');
  const intentID=useRef(crypto.randomUUID()),saved=useRef(false),action=useAction();
  const checkins=useLoad(()=>allRows<{created_at:string}>((from,to)=>db.from('checkins').select('created_at').order('created_at',{ascending:false}).range(from,to)),[db]);
  const count=streak((checkins.data??[]).map(row=>row.created_at));
  useEffect(()=>{if(phase!=='intention'||!text.trim()||saved.current)return;const handler=(event:Event)=>{confirmNavigation(event,'Your intention has not been saved.');};const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('wellvie-before-navigate',handler);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('wellvie-before-navigate',handler);window.removeEventListener('beforeunload',unload);};},[phase,text]);
  const journal=()=>go('/write?practice='+practice.id+'&return='+encodeURIComponent('/practice/'+practice.id+'?finished')+(practice.kind==='text'?'&prompt='+encodeURIComponent(practice.title):''));
  return <section className="gentle-close calm-route"><div className="gentle-mark" aria-hidden="true"><span/><Leaf size={34} fill="currentColor"/></div><h1>However that felt is enough.</h1>{sync==='saving'&&<p className="small" role="status">Saving this completion...</p>}{sync==='failed'&&<ErrorBox error="We couldn’t save this completion. Your reflection choices are still available." retry={retry}/>} {count>=2&&<p className="gentle-streak">{count} days of meeting yourself like this</p>}<div className="gentle-content calm-route" key={phase}>{phase==='choices'?<><button className="outline" onClick={journal}><BookOpen size={19}/>Journal on this</button><button className="outline" onClick={()=>setPhase('intention')}><Navigation2 size={19}/>Set an intention</button><button className="outline tonal" onClick={()=>go('/toolkit')}>That’s enough for today</button>{sync==='saved'&&['affirmation','affirmations'].includes(practice.need_slug)&&<button className="text-action centered" onClick={()=>go('/history')}>View affirmation history</button>}</>:phase==='intention'?<form onSubmit={event=>{event.preventDefault();void action.run(async()=>{if(!text.trim())return;await rpc(db,'create_intention',{p_event_id:intentID.current,p_text:text.trim()});saved.current=true;setPhase('saved');});}}><h2>Today, I intend to...</h2><textarea autoFocus aria-label="Your intention" maxLength={500} value={text} onChange={event=>{intentID.current=crypto.randomUUID();setText(event.target.value);}} disabled={action.busy}/><IntentionSuggestions text={text} disabled={action.busy} onChoose={suggestion=>{intentID.current=crypto.randomUUID();setText(suggestion);action.setError(undefined);}}/>{action.error&&<ErrorBox error={action.error}/>}<div className="actions"><button className="primary" disabled={action.busy||!text.trim()}>Keep it</button><button type="button" className="outline" disabled={action.busy} onClick={()=>setPhase('choices')}>Not now</button></div></form>:<div className="intention-kept"><CheckCircle size={34}/><h2>It’s kept. Carry it lightly.</h2><p>Find it again in your Journal, under Intentions &amp; history.</p><button className="outline" onClick={()=>go('/history')}><BookOpen size={19}/>View my intentions</button><button className="primary" onClick={()=>go('/check-in')}>Return to my check-in</button></div>}</div></section>;
}
