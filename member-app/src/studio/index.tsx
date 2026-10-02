import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,CalendarDays,ClipboardList,Heart,Leaf,RefreshCw,Route,Shield,Users,Waves} from 'lucide-react';
import {useMember} from '../context';
import {Page,LinkCard,Loading} from '../ui';
import {Moderation} from '../circle';
import {LiveRepository} from './repository';
import {Alert,message} from './shared';
import {Members} from './members';
import {Content,Intake,Recordings} from './content';
import {Curation} from './curation';
import {Safety} from './safety';
import type {AdminRepository,Snapshot} from './types';
import './studio.css';

export const studioAreas=[
  {path:'members',title:'Members',description:'Invite members, see who has joined, and tend access.',icon:Users},
  {path:'practices',title:'Practices',description:'Write practices, attach recordings, and retire older work.',icon:Leaf},
  {path:'safety',title:'Circle safety',description:'Review messages and profiles, respond to reports, and care for the community.',icon:Shield},
  {path:'curation',title:'Curation',description:'Choose up to three practices for each pairing, or use the fallback.',icon:Route},
  {path:'feelings',title:'Feelings',description:'Name, order, show, or rest the words used at check-in.',icon:Heart},
  {path:'reset',title:'Reset weeks',description:'Arrange call replays, practices, imagery, and journal invitations.',icon:Waves},
  {path:'gatherings',title:'Gatherings',description:'Schedule live rooms, add replays, and retire old listings.',icon:CalendarDays},
  {path:'intake',title:'Intake',description:'Read the private words members shared before joining.',icon:ClipboardList},
  {path:'guide',title:'Studio guide',description:'A plain-language guide to tending every part of this space.',icon:BookOpen},
];
const chapters=[
  ['Invite a member','Add their name and email in Members. Sending an invitation emails that address. Members sign in with an email code. Revoke a waiting invitation if plans change. Removing a joined member permanently clears their sign-in and private data.'],
  ['Prepare a practice','Write a title and description, choose its Toolkit group, and save a draft. Upload the finished recording, reopen the practice, listen to it, then turn on Show to members. Written practices need their instructions before publishing.'],
  ['Curate the daily offering','Choose up to three practices for a feeling and need, in the order members should receive them. You can mix practice types. Clear the selection to use the same-need fallback. Remove retired practices from active pairings.'],
  ['Tend the language','Rename, reorder or hide feelings. Hiding preserves old check-ins. The own-words list contains only phrases and counts.'],
  ['Build The Reset','Each week holds a call replay, breathwork, somatic practice and journal invitations. Save the week first, then upload its artwork. Artwork changes do not overwrite the other week details.'],
  ['Publish a gathering','Add its date, duration and live link. The time picker uses your device’s time zone; members see their local time. Add a replay later. Turn off Show to members to retire it from both upcoming and replay shelves.'],
  ['Tend circles','Use Circle → New circle to create a private group. Open a circle’s options to manage members. Members added to a circle can read its earlier messages.'],
  ['Care for the community','Circle safety holds profile reviews and member reports. Open Chat review & reports for messages. Read the reported content and photo before making a decision.'],
  ['Protect member trust','Intake is visible only to founders. Members’ private journals, check-ins and intention histories never appear in Studio. Give founder access sparingly and confirm the correct person before permanent removal.'],
];
export default function FounderStudio({section='',repository:override}:{section?:string;repository?:AdminRepository}){
  const {db,profile,go}=useMember();const repository=useMemo(()=>override??new LiveRepository(db),[db,override]);
  const [data,setData]=useState<Snapshot>(),[memberID,setMemberID]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[allowed,setAllowed]=useState(false);const generation=useRef(0);
  const refresh=useCallback(async()=>{const attempt=++generation.current;setLoading(true);setError('');try{const result=await repository.load();if(attempt!==generation.current)return;setData(result.data);setMemberID(result.memberId);setAllowed(true);}catch(e){if(attempt===generation.current){setData(undefined);setAllowed(false);setError(message(e));}}finally{if(attempt===generation.current)setLoading(false);}},[repository]);
  useEffect(()=>{if(!profile.is_admin){setData(undefined);setAllowed(false);setLoading(false);return;}void refresh();return()=>{generation.current++;};},[profile.is_admin,refresh]);
  useEffect(()=>{
    if(!profile.is_admin)return;let active=true,checking=false;
    const check=async()=>{if(document.hidden||checking)return;checking=true;try{await repository.checkAccess();}catch(e){if(active){generation.current++;setAllowed(false);setData(undefined);setLoading(false);setError(message(e));}}finally{checking=false;}};
    const timer=setInterval(()=>void check(),60000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
  },[profile.is_admin,repository]);
  const area=studioAreas.find(area=>area.path===section);
  if(!profile.is_admin)return <Page className="studio-page" title="Founder Studio"><p>Administrator access is required.</p></Page>;
  if(!allowed||!data)return <Page className="studio-page" eyebrow="Well-Vie studio" title="Your studio">{loading?<Loading/>:<><Alert error={error}/><button className="outline" onClick={()=>void refresh()}>Try again</button></>}</Page>;
  if(section==='chat-review')return <div className="studio-page"><Moderation backTo="/studio/safety"/></div>;
  const done=()=>{void refresh();};
  return <Page className="studio-page" eyebrow={section?'Studio':'Well-Vie studio'} title={area?.title??(section==='recordings'?'Recording storage check':'Your studio')} intro={area?.description??(!section?'Everything you need to tend the space, without touching the database.':undefined)} action={section&&<button className="icon-button" aria-label="Refresh Studio" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={20}/></button>}>
    <Alert error={error}/>{loading&&<p className="small" role="status">Refreshing…</p>}
    {!section?<div className="studio-areas">{studioAreas.map(({path,title,description,icon:Icon})=><LinkCard key={path} title={title} detail={description} icon={<Icon/>} onClick={()=>go('/studio/'+path)}/>)}</div>:section==='members'?<Members data={data} repository={repository} memberID={memberID} refresh={done}/>:section==='safety'?<Safety data={data} repository={repository} refresh={done} go={go}/>:section==='curation'?<Curation data={data} repository={repository} refresh={done}/>:section==='intake'?<Intake data={data}/>:section==='recordings'?<Recordings repository={repository}/>:section==='guide'?<div className="stack">{chapters.map(([title,text],index)=><article className="card studio-record" key={title}><h2>{index+1}. {title}</h2><p>{text}</p></article>)}</div>:['practices','feelings','reset','gatherings'].includes(section)?<Content table={section==='reset'?'program_weeks':section==='gatherings'?'events':section as 'practices'|'feelings'} data={data} repository={repository} refresh={done} go={go}/>:<p>This Studio page could not be found.</p>}
  </Page>;
}
