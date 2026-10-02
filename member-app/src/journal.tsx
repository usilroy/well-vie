import {useEffect,useRef,useState} from 'react';
import {BookOpen,Download,History,PenLine,Trash2,Quote,Leaf,Navigation,ChevronRight} from 'lucide-react';
import {useMember} from './context';
import {completedAffirmations} from './reflections-data';
import {type Entry,type Intention,type Checkin,result,rpc,allRows,downloadText,cleanCopy,gentleStreak} from './data';
import {Page,Loading,ErrorBox,Empty,useLoad,useAction,dateLabel,timeLabel} from './ui';
const journalColumns='id,title,prompt_text,practice_id,body,created_at';
export function Journal(){
  const {db,go}=useMember();
  const load=useLoad(()=>allRows<Entry>((from,to)=>db.from('journal_entries').select(journalColumns).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to)),[db]);
  const action=useAction();const exportEntries=()=>downloadText('well-vie-journal.txt',(load.data??[]).map(e=>`${dateLabel(e.created_at)}\n${e.title??''}\n${e.prompt_text??''}\n\n${e.body}`).join('\n\n________\n\n'));
  return <Page eyebrow="Private journal" title="A place for your own words" intro="These entries stay tied to your account and are not shared with other members." action={<button className="primary" onClick={()=>go('/write')}><PenLine size={18}/>Write</button>}>
    {load.loading?<Loading/>:load.error?<ErrorBox error={load.error} retry={load.reload}/>:<>
      {gentleStreak((load.data??[]).map(e=>e.created_at))>=2&&<p className="streak-note">You’ve journaled {gentleStreak((load.data??[]).map(e=>e.created_at))} days in a row</p>}<div className="actions journal-tools"><button className="outline tonal" onClick={()=>go('/intention?return=/journal')}><Navigation size={18}/>Set intention</button><button className="outline" onClick={exportEntries}><Download size={18}/>Take a copy</button><button className="outline tonal" onClick={()=>go('/history')}><History size={18}/>Intentions & history</button></div>
      {!load.data?.length?<Empty title="Your journal begins here" icon={<BookOpen size={32}/>}><p>Write freely, or begin from a journal invitation inside The Reset.</p></Empty>:<div className="stack journal-entries">{load.data.map(e=><article className="card entry-card" key={e.id}><button className="entry-open" onClick={()=>go('/journal/'+e.id)}><h2>{cleanCopy(e.title)||dateLabel(e.created_at)}</h2>{e.prompt_text&&<p className="entry-prompt">{cleanCopy(e.prompt_text)}</p>}<p className="line-clamp entry-body">{e.body}</p><small>{timeLabel(e.created_at)}</small></button><button className="icon-button" aria-label="Delete entry" disabled={action.busy} onClick={()=>{if(window.confirm('Delete this journal entry permanently? This cannot be undone.'))void action.run(async()=>{await result(db.from('journal_entries').delete().eq('id',e.id));await load.reload();});}}><Trash2 size={18}/></button></article>)}</div>}{action.error&&<ErrorBox error={action.error}/>}
    </>}
  </Page>;
}
export function WriteJournal({query}:{query:string}){
  const {db,go}=useMember(),params=new URLSearchParams(query);
  const [prompt,setPrompt]=useState(params.get('prompt'));
  const practice=Number(params.get('practice'))||null;
  const returnTo=params.get('return')||'/journal';
  const [title,setTitle]=useState(''),[body,setBody]=useState('');
  const id=useRef(crypto.randomUUID()),saved=useRef(false),action=useAction();
  const prompts=useLoad(()=>result<{id:number;text:string}[]>(db.from('prompts').select('id,text').eq('active',true).order('id')),[db]);
  useEffect(()=>{if(!body&&!title)return;const unload=(e:BeforeUnloadEvent)=>{if(!saved.current){e.preventDefault();e.returnValue='';}};const navigate=(e:Event)=>{if(!saved.current&&!window.confirm('Leave this reflection without saving?'))e.preventDefault();};window.addEventListener('beforeunload',unload);window.addEventListener('wellvie-before-navigate',navigate);return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('wellvie-before-navigate',navigate);};},[body,title]);
  return <section className="journal-write calm-enter"><form onSubmit={e=>{e.preventDefault();void action.run(async()=>{if(!body.trim())throw new Error('Please enter a few words before saving.');await rpc(db,'create_journal_entry',{p_event_id:id.current,p_title:title.trim()||null,p_prompt_text:prompt||null,p_practice_id:practice,p_body:body.trim()});saved.current=true;go(returnTo);});}}>
    <div className="card journal-invitations">{prompt?<><h2>{cleanCopy(prompt)}</h2><button type="button" className="journal-change-prompt" onClick={()=>setPrompt(null)}>Choose a different journal invitation</button></>:<><h2>Or begin with a journal invitation</h2>{prompts.loading?<Loading/>:prompts.error?<ErrorBox error={prompts.error} retry={prompts.reload}/>:prompts.data?.map(p=><button type="button" key={p.id} className="outline tonal" onClick={()=>setPrompt(p.text)}><Quote size={18}/>{cleanCopy(p.text)}</button>)}</>}</div>
    <input aria-label="Title (optional)" placeholder="Title (optional)" maxLength={120} value={title} disabled={action.busy} onChange={e=>{id.current=crypto.randomUUID();setTitle(e.target.value);}}/>
    <textarea autoFocus aria-label="Journal entry" className="journal-editor" placeholder="Your words" required maxLength={20000} value={body} disabled={action.busy} onChange={e=>{id.current=crypto.randomUUID();setBody(e.target.value);}}/>
    {action.error&&<ErrorBox error={action.error}/>}<button className="primary full-width" disabled={action.busy||!body.trim()}>{action.busy?'Saving...':'Save privately'}</button>
  </form></section>;
}
export function JournalEntry({id}:{id:number}){const {db,go}=useMember();const load=useLoad(()=>result<Entry|null>(db.from('journal_entries').select(journalColumns).eq('id',id).maybeSingle()),[db,id]);const action=useAction();const entry=load.data;return <Page eyebrow={entry?dateLabel(entry.created_at)+' · '+timeLabel(entry.created_at):'Your journal'} title={entry?.title?.trim()||entry?.prompt_text?.trim()||(entry?dateLabel(entry.created_at):'Your entry')} intro={entry?.prompt_text?.trim()||'A private entry, not shared with other members.'}>{load.loading?<Loading/>:load.error?<ErrorBox error={load.error} retry={load.reload}/>:entry?<div className="card journal-detail"><p className="pre-wrap">{entry.body}</p>{entry.practice_id&&<span className="written-after"><Leaf size={14}/>Written after a practice</span>}<button className="outline danger" disabled={action.busy} onClick={()=>{if(window.confirm('Delete this journal entry permanently? This cannot be undone.'))void action.run(async()=>{await result(db.from('journal_entries').delete().eq('id',id));go('/journal');});}}><Trash2 size={17}/>Let this entry go</button></div>:<Empty title="This entry is no longer in your journal"/>}{action.error&&<ErrorBox error={action.error}/>}</Page>;}
export function ReflectionHistory(){
  const {db,profile,go}=useMember();
  const load=useLoad(async()=>{
    const [intentions,checkins,entries]=await Promise.all([
      allRows<Intention>((a,b)=>db.from('intentions').select('id,text,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).range(a,b)),
      allRows<Checkin>((a,b)=>db.from('checkins').select('id,custom_feeling,created_at,feelings(label),needs(label)').order('created_at',{ascending:false}).order('id',{ascending:false}).range(a,b)),
      allRows<Entry>((a,b)=>db.from('journal_entries').select(journalColumns).order('created_at',{ascending:false}).order('id',{ascending:false}).range(a,b)),
    ]);
    return {intentions,checkins,entries};
  },[db]);
  const affirmations=useLoad(()=>completedAffirmations(db,profile.id),[db,profile.id]);
  const history=load.data;
  const checkTitle=(c:Checkin)=>(c.custom_feeling||c.feelings?.label||'checked in').toLowerCase()+(c.needs?.label?' · '+c.needs.label.toLowerCase():'');
  const exportHistory=()=>downloadText('well-vie-reflections.txt',history?[
    'Your intentions',...history.intentions.map(i=>i.text+'\n'+dateLabel(i.created_at)),
    'Completed affirmations',...(affirmations.data??[]).map(item=>item.practices.title+'\n'+(item.practices.body_text||'')+'\n'+dateLabel(item.created_at)+' · '+timeLabel(item.created_at)),
    'How you have arrived',...history.checkins.map(c=>checkTitle(c)+'\n'+dateLabel(c.created_at)),
    'Your journal',...history.entries.map(e=>(e.title||e.prompt_text||dateLabel(e.created_at))+'\n'+e.body),
  ].join('\n\n'):'');
  const hasHistory=history&&(history.intentions.length||history.checkins.length||history.entries.length||affirmations.data?.length);
  return <Page action={<button className="outline" onClick={()=>go('/intention?return=/history')}><Navigation size={18}/>Set intention</button>} eyebrow="Private reflections" title="Looking back" intro="Your intentions, completed affirmations and reflections, kept privately in one place.">
    {load.loading||affirmations.loading?<Loading/>:load.error?<ErrorBox error={load.error} retry={load.reload}/>:!history?null:!hasHistory&&!affirmations.error?<Empty title="Every season starts here" icon={<History size={32}/>}><p>Your saved intentions, completed affirmations and journal entries will appear here.</p></Empty>:<div className="reflection-history">
      <button className="outline" onClick={exportHistory} disabled={!!affirmations.error}><Download size={18}/>Take a copy of all of it</button>
      {history.intentions[0]&&<article className="card current-intention"><h2 className="reflection-heading"><Navigation size={14}/>Where you are pointed now</h2><h3>{history.intentions[0].text}</h3><small>{dateLabel(history.intentions[0].created_at)}</small></article>}
      {history.intentions.length>0&&<section><h2 className="reflection-heading"><Navigation size={14}/>Your intentions</h2><div className="stack">{history.intentions.map(i=><article className="card reflection-row" key={i.id}><p>{i.text}</p><small>{dateLabel(i.created_at)}</small></article>)}</div></section>}
      <section className="affirmation-history"><h2 className="reflection-heading"><Quote size={14}/>Completed affirmations</h2>
        {affirmations.error?<ErrorBox error={affirmations.error} retry={affirmations.reload}/>:!affirmations.data?.length?<p>Affirmations appear here after you tap “I’ve taken this in”.</p>:<div className="stack">{affirmations.data.map(item=><article className="card reflection-row" key={item.id}><h3>{cleanCopy(item.practices.title)}</h3>{item.practices.body_text&&<p className="affirmation-copy line-clamp">{cleanCopy(item.practices.body_text)}</p>}<small>{dateLabel(item.created_at)} · {timeLabel(item.created_at)}</small>{item.practices.active&&<button className="text-action" onClick={()=>go('/practice/'+item.practices.id)}>Read again<ChevronRight size={14}/></button>}</article>)}</div>}
      </section>
      {history.checkins.length>0&&<section><h2 className="reflection-heading"><Leaf size={14}/>How you have arrived</h2><div className="stack">{history.checkins.map(c=><article className="card reflection-row" key={c.id}><p>{checkTitle(c)}</p><small>{dateLabel(c.created_at)}</small></article>)}</div></section>}
      {history.entries.length>0&&<section><h2 className="reflection-heading"><BookOpen size={14}/>Your journal</h2><div className="stack">{history.entries.map(e=><button className="card reflection-row reflection-link" key={e.id} onClick={()=>go('/journal/'+e.id)}><span className="grow"><p>{e.title?.trim()||e.prompt_text?.trim()||dateLabel(e.created_at)}</p><small>{dateLabel(e.created_at)}</small></span><ChevronRight size={14}/></button>)}</div></section>}
    </div>}
  </Page>;
}
