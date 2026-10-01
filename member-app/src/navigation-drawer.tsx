import {useEffect, useRef, useState} from 'react';
import {CircleIcon} from './circle-icon';
import {Menu, X, Leaf, Sparkles, BookOpen, CalendarDays, UserRound, Moon} from 'lucide-react';

const destinations = [
  {path:'/check-in',label:'Check in',icon:Leaf},
  {path:'/toolkit',label:'Toolkit',icon:Sparkles},
  {path:'/journal',label:'Journal',icon:BookOpen},
  {path:'/gatherings',label:'Gatherings',icon:CalendarDays},
  {path:'/reset',label:'The Reset',icon:Leaf},
  {path:'/circle',label:'Circle',icon:CircleIcon},
  {path:'/profile',label:'My profile',icon:UserRound},
];

export function NavigationDrawer({active, unread, go, theme, setTheme}:{active:string;unread:number;go:(path:string)=>void;theme:string;setTheme:(value:string)=>void}) {
  const panel=useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false);
  const [closing,setClosing]=useState(false);
  const touch=useRef<{x:number;y:number}|undefined>(undefined);
  const [drag,setDrag]=useState(0);
  const finishClose=()=>{panel.current?.close();setOpen(false);setClosing(false);setDrag(0);touch.current=undefined;};
  const close=()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)finishClose();else setClosing(true);};
  useEffect(()=>{if(!closing)return;const timer=setTimeout(finishClose,220);return()=>clearTimeout(timer);},[closing]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[open]);
  return <>
    <button className="icon-button drawer-trigger" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={open}
      onClick={()=>{setClosing(false);panel.current?.showModal();panel.current?.focus({preventScroll:true});setOpen(true);}}><Menu size={24}/></button>
    <dialog ref={panel} className="navigation-drawer" aria-label="Navigation" tabIndex={-1} data-closing={closing} style={{transform:drag?`translateX(${drag}px)`:undefined}} onCancel={event=>{event.preventDefault();close();}} onClose={()=>{setOpen(false);setClosing(false);setDrag(0);}}
      onTouchStart={event=>{const point=event.touches[0];touch.current={x:point.clientX,y:point.clientY};}}
      onTouchMove={event=>{if(!touch.current)return;const point=event.touches[0];const dx=point.clientX-touch.current.x;const dy=point.clientY-touch.current.y;if(Math.abs(dy)>Math.abs(dx)+12){touch.current=undefined;setDrag(0);return;}if(dx< -10)setDrag(dx);}}
      onTouchEnd={event=>{const start=touch.current;const end=event.changedTouches[0];const dx=start&&end?end.clientX-start.x:0;const dy=start&&end?end.clientY-start.y:0;if(dx< -60&&Math.abs(dx)>Math.abs(dy))close();else setDrag(0);touch.current=undefined;}}
      onTouchCancel={()=>{touch.current=undefined;setDrag(0);}}
      onClick={event=>{if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}>
      <div className="drawer-heading"><img src="/app/assets/wordmark.png" alt="Well-Vie"/><button className="icon-button drawer-close" aria-label="Close navigation" onClick={close}><X size={18}/></button></div>
      <nav aria-label="Main navigation">{destinations.map(({path,label,icon:Icon})=><button key={path} aria-current={active===path?'page':undefined} onClick={()=>{close();go(path);}}><Icon size={path==='/circle'?29:23}/><span>{label}</span>{path==='/circle'&&unread>0&&<small className="badge">{unread>99?'99+':unread}</small>}</button>)}</nav>
      <div className="drawer-preferences">
        <label className="drawer-theme-toggle">
          <Moon size={21} aria-hidden="true"/>
          <span>Prefer it dimmer?</span>
          <input type="checkbox" role="switch" checked={theme==='dusk'} onChange={event=>setTheme(event.target.checked?'dusk':'light')}/>
          <span className="drawer-switch-track" aria-hidden="true"/>
        </label>
      </div>
    </dialog>
  </>;
}
