export const intentionSuggestions = [
  'Be present',
  'Remember to breathe',
  'Make space for rest',
  'Take one step at a time',
  'Choose love',
  'Focus on what matters',
] as const;

// A fresh prompt follows the member's local day, including daylight-saving days.
// This only changes what is current; saved history is never removed.
export function isTodaysIntention(savedAt:string, now=new Date()) {
  const saved=new Date(savedAt);
  return Number.isFinite(saved.getTime()) && saved.getFullYear()===now.getFullYear()
    && saved.getMonth()===now.getMonth() && saved.getDate()===now.getDate();
}

export function nextLocalMidnight(now=new Date()) {
  return new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
}
