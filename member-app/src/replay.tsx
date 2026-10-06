import {useEffect,useRef,useState} from 'react';
import {useMember} from './context';
import {result,signedURL} from './data';
import {Page,Loading,ErrorBox,useLoad} from './ui';
import {REPLAY_ID} from './replay-link';
import './replay.css';
type ReplayAsset={id:string;title:string;storage_path:string;duration_sec:number};
export function Replay({id}:{id:string}) {
  const {db,pause,go}=useMember();
  const video=useRef<HTMLVideoElement>(null),resumeAt=useRef(0);
  const [playbackError,setPlaybackError]=useState('');
  const load=useLoad(async()=>{
    if(!REPLAY_ID.test(id))throw new Error('This replay link is not valid.');
    const asset=await result<ReplayAsset|null>(db.from('replay_assets').select('id,title,storage_path,duration_sec').eq('id',id).maybeSingle());
    if(!asset)throw new Error('This replay is no longer available for your account.');
    const url=await signedURL(db,'replay-videos',asset.storage_path,7200);
    return {asset,url};
  },[db,id]);
  useEffect(()=>()=>{video.current?.pause();},[id]);
  const retry=()=>{resumeAt.current=video.current?.currentTime??0;setPlaybackError('');void load.reload();};
  return <Page eyebrow="To watch again" title={load.data?.asset.title??'Your replay'} className="replay-page">
    {load.loading?<Loading/>:load.error?<ErrorBox error={load.error} retry={retry}/>:load.data&&<>
      <video ref={video} className="replay-video" controls playsInline preload="metadata" src={load.data.url}
        onPlay={pause} onLoadedMetadata={e=>{if(resumeAt.current)e.currentTarget.currentTime=Math.min(resumeAt.current,e.currentTarget.duration);}}
        onError={()=>setPlaybackError('The video could not load. Reconnect and try again to continue from here.')}/>
      <p className="small muted">{Math.ceil(load.data.asset.duration_sec/60)} minutes · A little space to return to.</p>
      {playbackError&&<ErrorBox error={playbackError} retry={retry}/>}
    </>}
    <button className="outline" onClick={()=>go('/gatherings')}>Back to gatherings</button>
  </Page>;
}
