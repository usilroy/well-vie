import type {DB} from './data.ts';
export type RSVPStatus='going'|'maybe'|'declined';
export type ResponseStatus=RSVPStatus|'unanswered'|'needs_confirmation';
export type RSVP={event_id:number;status:RSVPStatus;event_starts_at:string;updated_at:string};
export const rsvpLabels:Record<ResponseStatus,string>={going:'Going',maybe:'Maybe',declined:'Can’t make it',unanswered:'No reply',needs_confirmation:'Confirm again'};
export type AttendanceMember={user_id:string;name:string;status:ResponseStatus;updated_at:string|null};
export type AttendancePage={counts:Record<ResponseStatus,number>;members:AttendanceMember[];hasMore:boolean};
export function responseStatus(response:RSVP|null|undefined,startsAt:string):ResponseStatus {
  if(!response)return 'unanswered';
  return Date.parse(response.event_starts_at)===Date.parse(startsAt)?response.status:'needs_confirmation';
}
export function rsvpError(error:unknown):string {
  const message=error&&typeof error==='object'&&'message'in error?String(error.message):'';
  if(/gathering time changed|RSVPs are closed|gathering is no longer available/.test(message))return message;
  return 'Your response could not be saved. Check your connection and try again.';
}
export async function saveRSVP(db:DB,eventId:number,startsAt:string,status:RSVPStatus|null):Promise<RSVP|null> {
  const {data,error}=await db.rpc('set_event_rsvp',{p_event_id:eventId,p_status:status,p_starts_at:startsAt});
  if(error)throw error;
  return data as RSVP|null;
}
