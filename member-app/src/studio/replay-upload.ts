import {Upload} from 'tus-js-client';
import type {SupabaseClient} from '@supabase/supabase-js';
import {config} from '../config.ts';
export const MAX_REPLAY_BYTES=500_000_000;
export function validateReplayFile(file:Pick<File,'name'|'size'|'type'>) {
  if(!/\.mp4$/i.test(file.name)||file.type&&file.type!=='video/mp4')throw new Error('Choose an MP4 video (H.264 with AAC audio).');
  if(file.size<=0||file.size>MAX_REPLAY_BYTES)throw new Error('Choose a video up to 500 MB.');
}
export async function inspectReplay(file:File):Promise<number> {
  validateReplayFile(file);
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),video=document.createElement('video');
    let settled=false;
    const finish=(duration?:number)=>{if(settled)return;settled=true;video.onerror=null;video.onloadedmetadata=null;clearTimeout(timer);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);duration?resolve(duration):reject(new Error('This video could not be read. Export it as an MP4 with H.264 video and AAC audio.'));};
    const timer=setTimeout(()=>finish(),15000);
    video.preload='metadata';video.onloadedmetadata=()=>{const duration=Math.ceil(video.duration);finish(Number.isFinite(duration)&&duration>0&&duration<=21600?duration:undefined);};
    video.onerror=()=>finish();video.src=url;
  });
}
export async function uploadReplayFile(client:SupabaseClient,file:File,id:string,onProgress:(percent:number)=>void) {
  const path=`replays/${id}.mp4`;
  // A completed upload may precede a timed-out attachment response. Never overwrite it.
  const existing=await client.storage.from('replay-videos').list('replays',{search:id+'.mp4',limit:10});
  if(existing.error)throw existing.error;
  if(existing.data?.some(object=>object.name===id+'.mp4')){onProgress(100);return;}
  const {data,error}=await client.storage.from('replay-videos').createSignedUploadUrl(path,{upsert:false});
  if(error||!data)throw error??new Error('Could not prepare this upload.');
  const endpoint=config.supabaseUrl.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable';
  await new Promise<void>((resolve,reject)=>{
    const upload=new Upload(file,{
      endpoint,headers:{'x-signature':data.token},chunkSize:6*1024*1024,
      uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,retryDelays:[0,1000,3000,5000,10000],
      // Scope resume records to the exact destination, not merely the source filename.
      fingerprint:async()=>[endpoint,path,file.size,file.lastModified].join('|'),
      metadata:{bucketName:'replay-videos',objectName:path,contentType:'video/mp4',cacheControl:'0'},
      onProgress:(sent,total)=>onProgress(Math.min(100,Math.round(sent/total*100))),
      onError:()=>reject(new Error('The upload was interrupted. Keep this page open and retry to continue.')),
      onSuccess:()=>resolve(),
    });
    void upload.findPreviousUploads().then(previous=>{if(previous[0])upload.resumeFromPreviousUpload(previous[0]);upload.start();}).catch(reject);
  });
}
