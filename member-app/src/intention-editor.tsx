import {useEffect,useRef,useState} from 'react';
import {useMember} from './context';
import {latestIntention} from './reflections-data';
import {rpc} from './data';
import {Page,Loading,ErrorBox,useLoad,useAction} from './ui';

export function IntentionEditor({query}:{query:string}){
  const {db,profile,go}=useMember();
  const load=useLoad(()=>latestIntention(db,profile.id),[db,profile.id]);
  const [text,setText]=useState('');
  const original=useRef(''),initialized=useRef(false),saved=useRef(false);
  const eventID=useRef(crypto.randomUUID());
  const action=useAction();
  const requestedReturn=new URLSearchParams(query).get('return');
  const returnTo=requestedReturn&&['/journal','/history'].includes(requestedReturn)?requestedReturn:'/check-in';

  useEffect(()=>{
    if(load.loading||initialized.current)return;
    initialized.current=true;
    original.current=load.data?.text??'';
    setText(original.current);
  },[load.loading,load.data]);

  useEffect(()=>{
    const dirty=text.trim()!==original.current.trim();
    const unload=(event:BeforeUnloadEvent)=>{
      if(!saved.current&&(dirty||action.busy)){event.preventDefault();event.returnValue='';}
    };
    const navigate=(event:Event)=>{
      if(saved.current)return;
      if(action.busy||(dirty&&!window.confirm('Discard your unsaved intention?')))event.preventDefault();
    };
    window.addEventListener('beforeunload',unload);
    window.addEventListener('wellvie-before-navigate',navigate);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('wellvie-before-navigate',navigate);};
  },[text,action.busy]);

  return <Page className="intention-editor-page" eyebrow="A small direction for today" title="Today, I intend to…" intro="A few words to carry with you.">
    <form className="intention-editor-form" onSubmit={event=>{
      event.preventDefault();
      if(load.loading||!text.trim())return;
      void action.run(async()=>{
        await rpc(db,'create_intention',{p_event_id:eventID.current,p_text:text.trim()});
        saved.current=true;
        window.dispatchEvent(new Event('wellvie-reflection-changed'));
        go(returnTo);
      });
    }}>
      {load.loading&&<Loading/>}
      {load.error&&<p className="small">Your current intention couldn’t load. You can still write a new one.</p>}
      <textarea aria-label="Your intention" maxLength={500} value={text} disabled={load.loading||action.busy}
        onChange={event=>{eventID.current=crypto.randomUUID();setText(event.target.value);action.setError(undefined);}}/>
      <p className="small">Your previous intentions stay in Journal → Intentions &amp; history.</p>
      {action.error&&<ErrorBox error="Your intention hasn’t been saved. Please try again."/>}
      <button className="primary full-width" disabled={load.loading||action.busy||!text.trim()}>{action.busy?'Keeping it…':'Keep it'}</button>
    </form>
  </Page>;
}
