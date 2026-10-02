import {confirmAction,confirmNavigation} from '../confirm-dialog';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight,Search} from 'lucide-react';
import {BottomSheet} from '../bottom-sheet';

export const message=(error:unknown)=>error instanceof Error?error.message:'We couldn’t complete that. Please try again.';
export const matches=(query:string,...values:(string|null|undefined)[])=>values.some(value=>value?.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes(query.trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()));
export const date=(value:string)=>new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'});
export function Alert({error}:{error:string}){return error?<p className="studio-error" role="alert">{error}</p>:null;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="studio-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Toggle({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean}){return <label className="studio-toggle"><span>{label}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/></label>;}
export function SearchField({value,onChange,label='Search'}:{value:string;onChange:(value:string)=>void;label?:string}){return <label className="studio-search"><Search size={19}/><input type="search" aria-label={label} placeholder={label} value={value} onChange={e=>onChange(e.target.value)}/></label>;}
export function Paged<T>({items,render,empty='Nothing here yet.'}:{items:T[];render:(item:T)=>ReactNode;empty?:string}){
  const [page,setPage]=useState(0);const pages=Math.max(1,Math.ceil(items.length/12)),index=Math.min(page,pages-1);
  useEffect(()=>setPage(0),[items]);
  return <>{!items.length?<p className="muted">{empty}</p>:<div className="studio-list">{items.slice(index*12,(index+1)*12).map(render)}</div>}{pages>1&&<nav className="studio-pagination" aria-label="Result pages"><button className="icon-button" aria-label="Previous page" disabled={!index} onClick={()=>setPage(index-1)}><ChevronLeft/></button><span>Page {index+1} of {pages} · {items.length} total</span><button className="icon-button" aria-label="Next page" disabled={index===pages-1} onClick={()=>setPage(index+1)}><ChevronRight/></button></nav>}</>;
}
// Both browser navigation and the in-app router honor unsaved work.
export function useEditorGuard(dirty:boolean,busy:boolean){
  useEffect(()=>{
    if(!dirty&&!busy)return;
    const navigate=(e:Event)=>{if(busy)e.preventDefault();else confirmNavigation(e,'Your changes have not been saved.');};
    const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('wellvie-before-navigate',navigate);window.addEventListener('beforeunload',unload);
    return()=>{window.removeEventListener('wellvie-before-navigate',navigate);window.removeEventListener('beforeunload',unload);};
  },[dirty,busy]);
}
export function EditorShell({title,children,busy,dirty=false,onClose,action}:{title:string;children:ReactNode;busy:boolean;dirty?:boolean;onClose:()=>void;action?:ReactNode}){
  useEditorGuard(dirty,busy);
  const canClose=async()=>!busy&&(!dirty||await confirmAction({title:'Discard changes?',message:'Your changes have not been saved.',confirmLabel:'Discard changes',cancelLabel:'Keep editing',danger:true}));
  return <BottomSheet open title={title} onClose={onClose} onBeforeClose={canClose} canDismiss={!busy} dismissLabel="Cancel" className="studio-sheet" action={action??<span/>}><div className="studio-form">{children}</div></BottomSheet>;
}
export type Decision={title:string;description:string;label:string;danger?:boolean;typeToConfirm?:string;run:()=>Promise<void>};
export function Confirm({decision,onClose,onDone}:{decision:Decision;onClose:()=>void;onDone:()=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[typed,setTyped]=useState('');const lock=useRef(false);
  return <EditorShell title={decision.title} busy={busy} onClose={onClose}><p>{decision.description}</p>{decision.typeToConfirm&&<Field label={'Type '+decision.typeToConfirm+' to confirm'}><input autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)}/></Field>}<Alert error={error}/><button className={'primary '+(decision.danger?'danger-button':'')} disabled={busy||!!decision.typeToConfirm&&typed!==decision.typeToConfirm} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await decision.run();onDone();}catch(e){setError(message(e));}finally{lock.current=false;setBusy(false);}}}>{busy?'Saving…':decision.label}</button></EditorShell>;
}
