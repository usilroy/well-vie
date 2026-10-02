import {useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import './confirm-dialog.css';

export type Confirmation={title:string;message?:string;confirmLabel?:string;cancelLabel?:string;danger?:boolean};
let queue=Promise.resolve();
/** Every request gets its own decision; a previous approval is never reused. */
export function confirmAction(options:Confirmation|string):Promise<boolean>{
  const detail:Confirmation=typeof options==='string'?{title:options}:options;
  const result=queue.then(()=>new Promise<boolean>(resolve=>{
    const host=document.createElement('div');document.body.append(host);
    const root=createRoot(host);let finished=false;
    const finish=(answer:boolean)=>{if(finished)return;finished=true;queueMicrotask(()=>{root.unmount();host.remove();resolve(answer);});};
    root.render(<ConfirmationDialog detail={detail} finish={finish}/>);
  }));
  queue=result.then(()=>{});return result;
}
function ConfirmationDialog({detail,finish}:{detail:Confirmation;finish:(answer:boolean)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const element=dialog.current!;const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();cancel.current?.focus();return()=>{element.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
  return <dialog ref={dialog} className="wellvie-confirmation" aria-labelledby="wellvie-confirm-title" aria-describedby={detail.message?'wellvie-confirm-description':undefined} onCancel={e=>{e.preventDefault();finish(false);}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish(false);}}><h2 id="wellvie-confirm-title">{detail.title}</h2>{detail.message&&<p id="wellvie-confirm-description">{detail.message}</p>}<div className="wellvie-confirm-actions"><button ref={cancel} className="outline" onClick={()=>finish(false)}>{detail.cancelLabel??'Cancel'}</button><button className={'primary'+(detail.danger?' danger':'')} onClick={()=>finish(true)}>{detail.confirmLabel??'Confirm'}</button></div></dialog>;
}
export type NavigationCheck={waitUntil:(answer:Promise<boolean>)=>void};
export function confirmNavigation(event:Event,message:string){
  const detail=(event as CustomEvent<NavigationCheck>).detail;
  if(detail?.waitUntil)detail.waitUntil(confirmAction({title:'Leave without saving?',message,confirmLabel:'Discard changes',cancelLabel:'Keep editing',danger:true}));
  else event.preventDefault();
}
