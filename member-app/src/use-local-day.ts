import {useEffect,useState} from 'react';
import {nextLocalMidnight} from './daily-intention';

export function useLocalDay() {
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const refresh=()=>{
      const current=new Date();setNow(current);
      clearTimeout(timer);
      timer=setTimeout(refresh,nextLocalMidnight(current).getTime()-current.getTime()+25);
    };
    const resume=()=>{if(document.visibilityState==='visible')refresh();};
    refresh();
    // Also catches a device time/time-zone change while the page stays open.
    const clockCheck=setInterval(resume,60000);
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('focus',resume);
    return()=>{clearTimeout(timer);clearInterval(clockCheck);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
  },[]);
  return now;
}
