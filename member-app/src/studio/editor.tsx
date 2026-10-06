import {ReplayUpload} from './replay-editor';
import {confirmAction} from '../confirm-dialog';
import {useEffect,useRef,useState} from 'react';
import {Alert,EditorShell,Field,Toggle,message} from './shared';
import type {AdminRepository,Draft,EditableTable,Practice,Snapshot,Week} from './types';

export function newDraft(table:EditableTable,data:Snapshot):Draft{
  if(table==='practices')return {title:'',kind:'audio',need_slug:data.needs.find(n=>n.active)?.slug??'',description:'',body_text:null,audio_path:null,duration_sec:null,is_placeholder:true,active:false};
  if(table==='feelings')return {label:'',slug:'',sort_order:Math.max(0,...data.feelings.map(f=>f.sort_order))+1,active:true};
  if(table==='events')return {title:'',kind:'gathering',description:'',starts_at:new Date().toISOString(),duration_min:60,join_url:null,replay_url:null,active:false};
  return {week_number:Math.max(0,...data.weeks.map(w=>w.week_number))+1,title:'',notes:'',call_replay_url:null,breathwork_practice_id:null,somatic_practice_id:null,prompt_ids:[]};
}
export function ContentEditor({table,initial,data,repository,onClose,onSaved}:{table:EditableTable;initial:Draft;data:Snapshot;repository:AdminRepository;onClose:()=>void;onSaved:()=>void}){
  const [draft,setDraft]=useState<Draft>(()=>({...initial,creation_token:initial.creation_token??crypto.randomUUID()}));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<File|null>(null),[operation,setOperation]=useState('');
  const [replayDirty,setReplayDirty]=useState(false);
  const [preview,setPreview]=useState(''),[previewBusy,setPreviewBusy]=useState(false),[auditioned,setAuditioned]=useState(false);
  const lock=useRef(false),alive=useRef(true),fileInput=useRef<HTMLInputElement>(null),formID=useRef('studio-editor-'+crypto.randomUUID());
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const str=(key:string)=>String(draft[key]??''),set=(key:string,value:unknown)=>setDraft(d=>({...d,[key]:value}));
  const changed=JSON.stringify({...draft,creation_token:undefined})!==JSON.stringify({...initial,creation_token:undefined});
  const dirty=changed||!!file||replayDirty;
  const label=table==='program_weeks'?'Reset week':table==='practices'?'practice':table==='events'?'gathering':'feeling';
  const playable=table==='practices'&&draft.kind==='audio'&&!!draft.audio_path&&!draft.is_placeholder&&!file;
  const activationLocked=table==='practices'&&draft.kind==='audio'&&!initial.active&&(!playable||!auditioned);
  const perform=async(work:()=>Promise<unknown>,done=true)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();if(done&&alive.current)onSaved();}catch(e){if(alive.current)setError(message(e));}finally{lock.current=false;if(alive.current)setBusy(false);}};
  const loadPreview=async()=>{setPreviewBusy(true);setError('');try{const url=await repository.signedUrl(table==='practices'?'practice-audio':'program-media',String(table==='practices'?initial.audio_path:initial.image_path));if(alive.current)setPreview(url);}catch(e){setError(message(e));}finally{setPreviewBusy(false);}};
  const localDate=(value:string)=>{const date=new Date(value);return Number.isFinite(+date)?new Date(+date-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';};
  return <EditorShell title={(initial.id?'Edit ':'New ')+label} busy={busy} dirty={dirty} onClose={onClose} action={<button type="submit" form={formID.current} disabled={busy||!!file||replayDirty}>{busy?'Saving…':'Save'}</button>}>
    <form id={formID.current} onSubmit={e=>{e.preventDefault();if(activationLocked&&draft.active){setError('Listen to the saved recording before publishing it.');return;}void perform(()=>repository.save(table,draft));}}>
      <fieldset disabled={busy} className="studio-fields">
        <Field label={table==='feelings'?'Feeling label':'Title'}><input required maxLength={120} value={str(table==='feelings'?'label':'title')} onChange={e=>set(table==='feelings'?'label':'title',e.target.value)}/></Field>
        {table==='practices'&&<>
          <Field label="Type"><select value={str('kind')} onChange={e=>{set('kind',e.target.value);setFile(null);setPreview('');setAuditioned(false);}}><option value="audio">Audio</option><option value="text">Written</option></select></Field>
          <Field label="Toolkit group"><select required value={str('need_slug')} onChange={e=>set('need_slug',e.target.value)}>{data.needs.map(n=><option key={n.id} value={n.slug}>{n.label}{n.active?'':' · retired'}</option>)}</select></Field>
          <Field label="Short description"><textarea rows={3} value={str('description')} onChange={e=>set('description',e.target.value)}/></Field>
          {draft.kind==='text'?<Field label="Words members will read"><textarea rows={8} value={str('body_text')} onChange={e=>set('body_text',e.target.value)}/></Field>:<>
            <Field label="Duration (seconds)" hint="Detected when a recording is uploaded."><input type="number" min={0} max={36000} value={str('duration_sec')} onChange={e=>set('duration_sec',e.target.value?Number(e.target.value):null)}/></Field>
            <p className="small">{playable?'Finished recording attached.':'No finished recording attached. Save the draft, then upload its recording.'}</p>
            {playable&&<><button type="button" className="outline" disabled={previewBusy} onClick={()=>void loadPreview()}>{previewBusy?'Opening…':'Listen to recording'}</button>{preview&&<audio controls src={preview} onPlaying={()=>setAuditioned(true)} onError={()=>{setAuditioned(false);setError('The recording could not play. Try opening it again.');}}/>}</>}
            {!initial.active&&<p className="small">Listen to the saved recording before making it available to members.</p>}
          </>}
        </>}
        {table==='program_weeks'&&<>
          <Field label="Week number"><input required type="number" min={1} max={52} value={str('week_number')} onChange={e=>set('week_number',Number(e.target.value))}/></Field>
          <Field label="Call replay link"><input type="url" placeholder="https://…" value={str('call_replay_url')} onChange={e=>set('call_replay_url',e.target.value||null)}/></Field>
          <Field label="Week notes"><textarea rows={5} value={str('notes')} onChange={e=>set('notes',e.target.value)}/></Field>
          {(['breathwork_practice_id','somatic_practice_id'] as const).map((key,index)=><Field key={key} label={index?'Somatic practice':'Breathwork practice'}><select value={str(key)} onChange={e=>set(key,e.target.value?Number(e.target.value):null)}><option value="">None</option>{data.practices.map(p=><option key={p.id} value={p.id}>{p.title}{p.active?'':' · draft / retired'}</option>)}</select></Field>)}
          <fieldset><legend>Journal invitations</legend>{data.prompts.map(p=><Toggle key={p.id} label={p.text+(p.active?'':' · inactive')} checked={((draft.prompt_ids as number[])??[]).includes(p.id)} onChange={checked=>set('prompt_ids',checked?[...((draft.prompt_ids as number[])??[]),p.id]:((draft.prompt_ids as number[])??[]).filter(id=>id!==p.id))}/>)}</fieldset>
          {!!initial.image_path&&<div className="studio-fields"><button type="button" className="outline" disabled={previewBusy} onClick={()=>void loadPreview()}>Preview artwork</button>{preview&&<img className="studio-artwork" src={preview} alt="Current week artwork"/>}<button type="button" className="outline" disabled={changed||!!file} onClick={async()=>{if(await confirmAction({title:'Remove this week’s artwork?',confirmLabel:'Remove artwork',danger:true}))void perform(()=>repository.removeImage(initial as unknown as Week));}}>Remove artwork</button></div>}
        </>}
        {table==='events'&&<>
          <Field label="Gathering type"><select value={str('kind')} onChange={e=>set('kind',e.target.value)}>{['gathering','workshop','breathwork','call','guest','retreat'].map(kind=><option key={kind} value={kind}>{kind}</option>)}</select></Field>
          <Field label="Description"><textarea rows={4} value={str('description')} onChange={e=>set('description',e.target.value)}/></Field>
          <Field label="Starts" hint={'Your time zone: '+Intl.DateTimeFormat().resolvedOptions().timeZone}><input type="datetime-local" required value={localDate(str('starts_at'))} onChange={e=>set('starts_at',e.target.value?new Date(e.target.value).toISOString():'')}/></Field>
          <Field label="Duration (minutes)"><input type="number" min={1} max={1440} value={str('duration_min')} onChange={e=>set('duration_min',e.target.value?Number(e.target.value):null)}/></Field>
          <Field label="Live room link"><input type="url" placeholder="https://…" value={str('join_url')} onChange={e=>set('join_url',e.target.value||null)}/></Field>
          <Field label="Replay link"><input type="url" placeholder="https://…" value={str('replay_url')} onChange={e=>set('replay_url',e.target.value||null)}/></Field>
        </>}
        {'active'in draft&&<Toggle label={table==='feelings'?'Available at check-in':'Show to members'} checked={!!draft.active} disabled={activationLocked&&!draft.active} onChange={checked=>set('active',checked)}/>}
      </fieldset>
      <Alert error={error}/>
    </form>
    {(table==='events'||table==='program_weeks')&&<ReplayUpload table={table} initial={initial} repository={repository} disabled={busy||changed||!!file} onDirty={setReplayDirty} perform={perform}/>}
    {!!initial.id&&(table==='program_weeks'||table==='practices'&&initial.kind==='audio'&&draft.kind==='audio')&&<fieldset disabled={busy||changed||replayDirty} className="studio-fields studio-upload"><legend>{table==='practices'?'Upload recording':'Upload artwork'}</legend><p className="small">{changed?'Save your changes and reopen before uploading.':table==='practices'?'MP3, M4A or WAV · up to 50 MB. Uploading returns this practice to draft.':'JPEG, PNG, WebP or GIF · up to 8 MB.'}</p><input ref={fileInput} type="file" aria-label={table==='practices'?'Audio file':'Artwork file'} accept={table==='practices'?'.mp3,.m4a,.wav':'image/jpeg,image/png,image/webp,image/gif'} onChange={e=>{setFile(e.target.files?.[0]??null);setOperation(crypto.randomUUID());setAuditioned(false);}}/>{file&&<button type="button" className="outline" onClick={()=>{setFile(null);if(fileInput.current)fileInput.current.value='';}}>Clear selected file</button>}<button type="button" className="outline" disabled={!file} onClick={()=>void perform(()=>table==='practices'?repository.uploadAudio(initial as unknown as Practice,file!,operation):repository.uploadImage(initial as unknown as Week,file!,operation))}>{busy?'Uploading…':'Upload file'}</button></fieldset>}
  </EditorShell>;
}
