import {useEffect,useState} from 'react';
import {Field} from './shared';
import type {AdminRepository,Draft} from './types';
import {inspectReplay,validateReplayFile} from './replay-upload';
import {replayRoute} from '../replay-link';
export function ReplayUpload({table,initial,repository,disabled,onDirty,perform}:{table:'events'|'program_weeks';initial:Draft;repository:AdminRepository;disabled:boolean;onDirty:(value:boolean)=>void;perform:(work:()=>Promise<unknown>)=>Promise<void>}) {
  const [file,setFile]=useState<File|null>(null),[id,setID]=useState(''),[progress,setProgress]=useState<number|null>(null),[error,setError]=useState(''),[preview,setPreview]=useState(''),[watched,setWatched]=useState(false);
  const existing=String(initial[table==='events'?'replay_url':'call_replay_url']??'');
  useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  return <fieldset disabled={disabled} className="studio-fields studio-upload"><legend>Upload a private replay</legend>
    <p className="small">MP4 (H.264 / AAC) · up to 500 MB. Preview it, then upload. Keep this page open until it finishes.</p>
    {existing&&<a href={existing} target="_blank" rel="noreferrer">{replayRoute(new URL(existing).search)?'Watch attached replay':'Open current replay'}</a>}
    {!initial.id?<p className="small">Save this {table==='events'?'gathering':'week'} first, then reopen it to add a video.</p>:<>
      <Field label="Replay video"><input type="file" accept="video/mp4,.mp4" onChange={e=>{const next=e.target.files?.[0]??null;setError('');setWatched(false);setProgress(null);try{if(next)validateReplayFile(next);setFile(next);setID(crypto.randomUUID());onDirty(!!next);}catch(error){setError((error as Error).message);e.target.value='';setFile(null);onDirty(false);}}}/></Field>
      {preview&&<video controls playsInline preload="metadata" src={preview} onPlaying={()=>setWatched(true)} onError={()=>{setWatched(false);setError('This video cannot play. Choose an MP4 with H.264 video and AAC audio.');}}/>}
      {file&&<p className="small">{watched?'Ready to upload.':'Play the preview to check the recording before uploading.'}{existing?' Uploading replaces the current replay link.':''}</p>}
      {progress!==null&&<div role="status"><progress max="100" value={progress}/><span>{progress===100?'Attaching replay…':`Uploading ${progress}%`}</span></div>}
      {error&&<p role="alert">{error}</p>}
      <button type="button" className="outline" disabled={!file||!watched} onClick={()=>void perform(async()=>{setProgress(0);const duration=await inspectReplay(file!);await repository.uploadReplay(table,initial,file!,id,duration,setProgress);})}>{progress!==null&&progress<100?'Retry upload':'Upload replay'}</button>
    </>}
  </fieldset>;
}
