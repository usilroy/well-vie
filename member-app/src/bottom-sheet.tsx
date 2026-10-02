import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function BottomSheet({open,onClose,title,children,action,dismissLabel="Done",canDismiss=true,className=""}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;action?:ReactNode;dismissLabel?:string;canDismiss?:boolean;className?:string}){
  const panel=useRef<HTMLDialogElement>(null);
  const [closing,setClosing]=useState(false),[drag,setDrag]=useState(0);
  const start=useRef<number|null>(null);
  const close=()=>{
    if(!canDismiss)return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){panel.current?.close();onClose();}
    else setClosing(true);
  };
  useEffect(()=>{
    if(!open){panel.current?.close();return;}
    setClosing(false);setDrag(0);
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    panel.current?.showModal();panel.current?.focus({preventScroll:true});
    return()=>{document.body.style.overflow=previous;};
  },[open]);
  useEffect(()=>{
    if(!closing||!canDismiss)return;
    const timer=setTimeout(()=>{panel.current?.close();onClose();setClosing(false);setDrag(0);},220);
    return()=>clearTimeout(timer);
  },[closing,onClose,canDismiss]);
  useEffect(()=>{if(!canDismiss){setClosing(false);setDrag(0);start.current=null;}},[canDismiss]);
  return createPortal(<dialog ref={panel} className={"bottom-sheet "+className} aria-label={title} tabIndex={-1} data-closing={closing} data-dragging={drag>0} style={drag&&!closing?{transform:`translateY(${drag}px)`}:undefined}
    onCancel={event=>{event.preventDefault();close();}}
    onClick={event=>{if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientY<bounds.top||event.clientX<bounds.left||event.clientX>bounds.right)close();}}>
    <button disabled={!canDismiss} className="sheet-grabber" aria-label={'Close '+title.toLowerCase()} onClick={close}
      onPointerDown={event=>{if(event.button!==0||!canDismiss)return;start.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(start.current!==null)setDrag(Math.max(0,event.clientY-start.current));}}
      onPointerUp={event=>{const distance=start.current===null?0:event.clientY-start.current;start.current=null;if(distance>64)close();else setDrag(0);}}
      onPointerCancel={()=>{start.current=null;setDrag(0);}}><span/></button>
    <header className={"sheet-heading "+(action?"sheet-heading-actions":"")}>{action&&<button className="sheet-dismiss" disabled={!canDismiss} onClick={close}>{dismissLabel}</button>}<h2>{title}</h2>{action??<button disabled={!canDismiss} onClick={close}>{dismissLabel}</button>}</header>
    <div className="sheet-body">{children}</div>
  </dialog>,document.body);
}
