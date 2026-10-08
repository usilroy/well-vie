export type ProgrammeAccess = "programme" | "app_only";
import type {AttendancePage,ResponseStatus} from '../rsvp-data';
export type Revision = {
  id: number;
  revision: number;
  creation_token?: string;
};
export type Practice = Revision & {
  title: string;
  need_slug: string;
  kind: "audio" | "text";
  description: string;
  body_text: string | null;
  audio_path: string | null;
  duration_sec: number | null;
  is_placeholder: boolean;
  active: boolean;
};
export type Feeling = Revision & {
  slug: string;
  label: string;
  sort_order: number;
  active: boolean;
};
export type Need = {
  id: number;
  slug: string;
  label: string;
  active: boolean;
  sort_order: number;
};
export type Week = Revision & {
  week_number: number;
  title: string;
  notes: string;
  call_replay_url: string | null;
  breathwork_practice_id: number | null;
  somatic_practice_id: number | null;
  prompt_ids: number[];
  image_path: string | null;
};
export type Gathering = Revision & {
  title: string;
  kind: string;
  description: string;
  starts_at: string;
  duration_min: number | null;
  join_url: string | null;
  replay_url: string | null;
  active: boolean;
};
export type Member = {
  programme_access?: ProgrammeAccess;
  id: string;
  name: string;
  is_admin: boolean;
  profile_visible: boolean;
  created_at: string;
  photo_path?: string | null;
  intention?: string;
  about?: string;
  hoping?: string;
  profile_prompts?: Record<string, string>;
  circle_moderation_status: "pending" | "approved" | "hidden";
  circle_moderation_note?: string;
  circle_moderation_version: number;
  circle_content_revision: number;
  updated_at: string;
};
export type Invite = {
  programme_access?: ProgrammeAccess;
  email: string;
  name: string;
  is_admin: boolean;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
};
export type Report = {
  id: number;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string;
  profile_snapshot: {
    name: string;
    about?: string;
    intention?: string;
    hoping?: string;
    photo_path?: string;
    profile_prompts?: Record<string, string>;
  };
  reported_revision: number;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution_version: number;
  profile_hidden: boolean;
  resolution_note: string | null;
  created_at: string;
};
export type Intake = {
  id: number;
  user_id: string;
  looking_for: string;
  why: string;
  how: string;
  created_at: string;
};
export type Curation = {
  id: number;
  feeling_id: number;
  need_id: number;
  practice_id: number;
  sort_order: number;
};
export type Snapshot = {
  members: Member[];
  invites: Invite[];
  practices: Practice[];
  feelings: Feeling[];
  needs: Need[];
  weeks: Week[];
  gatherings: Gathering[];
  reports: Report[];
  intake: Intake[];
  curation: Curation[];
  prompts: { id: number; text: string; active: boolean }[];
  customFeelings: { word: string; uses: number }[];
};
export type EditableTable =
  | "practices"
  | "feelings"
  | "program_weeks"
  | "events";
export type EditableRecord = Practice | Feeling | Week | Gathering;
export type Draft = Record<string, unknown> & {
  id?: number;
  revision?: number;
  creation_token?: string;
};
export type PublicConfig = {
  clerkKey: string;
  supabaseUrl: string;
  supabaseKey: string;
};
export interface AdminRepository {
  checkAccess(): Promise<string>;
  inventory(): Promise<AudioInventory>;
  attendance(eventId:number,filter:ResponseStatus|'all',query:string,offset:number):Promise<AttendancePage>;
  load(): Promise<{ data: Snapshot; memberId: string }>;
  save(table: EditableTable, draft: Draft): Promise<EditableRecord>;
  invite(name: string, email: string, isAdmin: boolean, programmeAccess?: ProgrammeAccess): Promise<void>;
  programmeAccess(userID: string|null, email: string|null, access: ProgrammeAccess, expected: ProgrammeAccess): Promise<void>;
  safetySummary(): Promise<{profile_approvals:number;profile_reports:number;chat_approvals:number;chat_reports:number}>;
  memberAction(
    action: "role" | "remove" | "revoke",
    id: string,
    role?: "member" | "admin",
  ): Promise<void>;
  moderate(
    member: Member,
    status: "approved" | "hidden",
    note: string,
  ): Promise<void>;
  resolve(
    report: Report,
    status: "resolved" | "dismissed",
    note: string,
    hide: boolean,
  ): Promise<void>;
  curate(feelingId: number, needId: number, ids: number[]): Promise<void>;
  reorderFeelings(ids: number[]): Promise<void>;
  uploadReplay(table: 'events'|'program_weeks', draft: Draft, file: File, id: string, duration: number, onProgress: (percent:number)=>void): Promise<void>;
  uploadAudio(
    practice: Practice,
    file: File,
    operationId: string,
  ): Promise<void>;
  uploadImage(week: Week, file: File, operationId: string): Promise<void>;
  removeImage(week: Week): Promise<void>;
  signedUrl(bucket: string, path: string): Promise<string>;
}

export type AudioObject={path:string;createdAt:string|null};
export type AudioInventory={scanned:number;referenced:number;candidates:AudioObject[];recent:AudioObject[];unknown:AudioObject[];scannedAt:string};
