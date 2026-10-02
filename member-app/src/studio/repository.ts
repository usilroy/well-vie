import {classifyAudio} from "./inventory.ts";
import { MAX_AUDIO_BYTES, authenticatedFetch } from "./transport.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminRepository,
  Draft,
  EditableRecord,
  EditableTable,
  Member,
  Practice,
  PublicConfig,
  Report,
  Snapshot,
  Week,
} from "./types.ts";
import {
  conflictMessage,
  isExactCommit,
  payloadFor,
  validateCuration,
  validateInvite,
} from "./validation.ts";
function fail(error: { message: string; code?: string } | null) {
  if (error)
    throw new Error(
      error.code === "PGRST116" ? conflictMessage : error.message,
    );
}
export function liveRepository(
  config: PublicConfig,
  getToken: () => Promise<string | null>,
): AdminRepository {
  return new LiveRepository(
    createClient(config.supabaseUrl, config.supabaseKey, {
      accessToken: getToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: authenticatedFetch },
    }),
  );
}
export class LiveRepository implements AdminRepository {
  private client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  async checkAccess() {
    const { data, error } = await this.client.rpc("current_member_context");
    fail(error);
    if (!data?.id || data.isAdmin !== true)
      throw new Error(
        "Your account does not have administrator access. Sign in with an invited Well-Vie admin account.",
      );
    return data.id as string;
  }
  private async all(table: string, columns: string, order = "id") {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.client
        .from(table)
        .select(columns)
        .order(order)
        .range(offset, offset + 499);
      fail(error);
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
      if (!data || data.length < 500) return rows;
    }
  }
  async inventory() {
    await this.checkAccess();
    const objects: {path:string;createdAt:string|null}[]=[];
    const directories=[''];const seen=new Set<string>();
    while(directories.length){
      const directory=directories.shift()!;
      if(seen.has(directory))continue;seen.add(directory);
      for(let offset=0;;offset+=100){
        const {data,error}=await this.client.storage.from('practice-audio').list(directory,{limit:100,offset,sortBy:{column:'name',order:'asc'}});fail(error);
        for(const file of data??[]){
          if(!file.name||file.name==='.'||file.name==='..'||file.name.includes('/'))throw new Error('Unexpected storage path. Scan stopped.');
          const path=directory?directory+'/'+file.name:file.name;
          if(!file.id)directories.push(path);else objects.push({path,createdAt:file.created_at??null});
        }
        if(!data||data.length<100)break;
      }
    }
    const references=new Set((await this.all('practices','id,audio_path')).map(p=>p.audio_path));
    await this.checkAccess();
    return classifyAudio(objects,references);
  }
  async load() {
    const memberId = await this.checkAccess();
    const specs = [
      [
        "members",
        "profiles",
        "id,name,is_admin,profile_visible,created_at,photo_path,intention,about,hoping,profile_prompts,circle_moderation_status,circle_moderation_note,circle_moderation_version,circle_content_revision,updated_at",
        "id",
      ],
      [
        "invites",
        "member_invites",
        "email,name,is_admin,accepted_by,accepted_at,created_at",
        "email",
      ],
      [
        "practices",
        "practices",
        "id,title,need_slug,kind,description,body_text,audio_path,duration_sec,is_placeholder,active,revision,creation_token",
        "id",
      ],
      [
        "feelings",
        "feelings",
        "id,slug,label,sort_order,active,revision,creation_token",
        "id",
      ],
      ["needs", "needs", "id,slug,label,sort_order,active", "id"],
      [
        "weeks",
        "program_weeks",
        "id,week_number,title,notes,call_replay_url,breathwork_practice_id,somatic_practice_id,prompt_ids,image_path,revision,creation_token",
        "id",
      ],
      [
        "gatherings",
        "events",
        "id,title,kind,description,starts_at,duration_min,join_url,replay_url,active,revision,creation_token",
        "id",
      ],
      [
        "reports",
        "member_reports",
        "id,reporter_id,reported_user_id,reason,details,profile_snapshot,reported_revision,status,resolution_version,profile_hidden,resolution_note,created_at",
        "id",
      ],
      [
        "intake",
        "intake_responses",
        "id,user_id,looking_for,why,how,created_at",
        "id",
      ],
      [
        "curation",
        "curation_map",
        "id,feeling_id,need_id,practice_id,sort_order",
        "id",
      ],
      ["prompts", "prompts", "id,text,active", "id"],
    ];
    const entries = await Promise.all(
      specs.map(async ([key, table, columns, order]) => [
        key,
        await this.all(table, columns, order),
      ]),
    );
    const { data: customFeelings, error } = await this.client.rpc(
      "custom_feeling_counts",
    );
    fail(error);
    const data = {
      ...Object.fromEntries(entries),
      customFeelings: customFeelings ?? [],
    } as Snapshot;
    data.weeks.sort((a, b) => a.week_number - b.week_number);
    data.feelings.sort((a, b) => a.sort_order - b.sort_order);
    await this.checkAccess();
    return { data, memberId };
  }
  async save(table: EditableTable, draft: Draft): Promise<EditableRecord> {
    await this.checkAccess();
    const payload = payloadFor(table, draft);
    if (draft.id == null) {
      const prior = await this.client
        .from(table)
        .select("*")
        .eq("creation_token", draft.creation_token)
        .maybeSingle();
      fail(prior.error);
      if (prior.data) {
        if (isExactCommit(prior.data, payload, 0)) return prior.data;
        throw new Error(conflictMessage);
      }
    }
    const result =
      draft.id != null
        ? await this.client
            .from(table)
            .update(payload)
            .eq("id", draft.id)
            .eq("revision", draft.revision)
            .select("*")
            .single()
        : await this.client.from(table).insert(payload).select("*").single();
    if (!result.error) return result.data as EditableRecord;
    // A timeout may follow a committed write. Recover only this precise operation.
    const current = await this.client
      .from(table)
      .select("*")
      .eq(
        draft.id != null ? "id" : "creation_token",
        draft.id ?? draft.creation_token,
      )
      .maybeSingle();
    if (
      current.data &&
      isExactCommit(
        current.data,
        payload,
        draft.id != null ? draft.revision! + 1 : 0,
      )
    )
      return current.data;
    if (
      current.data &&
      draft.id != null &&
      current.data.revision !== draft.revision
    )
      throw new Error(conflictMessage);
    fail(result.error);
    throw new Error("The record could not be saved.");
  }
  private async edge(name: string, body: Record<string, unknown>) {
    await this.checkAccess();
    const { data, error } = await this.client.functions.invoke(name, { body });
    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        const value = await error.context.json().catch(() => null);
        message = value?.error ?? message;
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async invite(name: string, email: string, isAdmin: boolean) {
    const normalized = validateInvite(name, email);
    await this.edge("admin-invite-member", {
      name: name.trim(),
      email: normalized,
      isAdmin,
      sendEmail: true,
    });
  }
  async memberAction(
    action: "role" | "remove" | "revoke",
    id: string,
    role?: "member" | "admin",
  ) {
    await this.edge(
      action === "role"
        ? "admin-set-member-role"
        : action === "remove"
          ? "admin-remove-member"
          : "admin-revoke-invite",
      action === "revoke"
        ? { email: id }
        : action === "role"
          ? { userID: id, role }
          : { userID: id },
    );
  }
  private async rpc(name: string, params: Record<string, unknown>) {
    await this.checkAccess();
    const { data, error } = await this.client.rpc(name, params);
    fail(error);
    return data;
  }
  async moderate(member: Member, status: "approved" | "hidden", note: string) {
    await this.checkAccess();
    const normalized=note.trim()||null;
    try { await this.rpc("moderate_circle_profile", {
      p_profile_id: member.id,
      p_expected_revision: member.circle_content_revision,
      p_expected_moderation_version: member.circle_moderation_version,
      p_status: status,
      p_note: normalized,
    }); } catch(error) {
      const current=await this.client.from('profiles').select('id,circle_content_revision,circle_moderation_version,circle_moderation_status,circle_moderation_note').eq('id',member.id).maybeSingle();
      const row=current.data;
      if(!current.error&&row&&row.circle_content_revision===member.circle_content_revision&&row.circle_moderation_version===member.circle_moderation_version+1&&row.circle_moderation_status===status&&(row.circle_moderation_note||null)===normalized)return;
      throw error;
    }
  }
  async resolve(
    report: Report,
    status: "resolved" | "dismissed",
    note: string,
    hide: boolean,
  ) {
    await this.checkAccess();
    const normalized=note.trim()||null;
    try { await this.rpc("resolve_member_report", {
      p_report_id: report.id,
      p_expected_resolution_version: report.resolution_version,
      p_status: status,
      p_note: normalized,
      p_hide_profile: hide,
    }); } catch(error) {
      const current=await this.client.from('member_reports').select('id,resolution_version,status,profile_hidden,resolution_note').eq('id',report.id).maybeSingle();
      const row=current.data;
      if(!current.error&&row&&row.resolution_version===report.resolution_version+1&&row.status===status&&row.profile_hidden===hide&&(row.resolution_note||null)===normalized){
        if(!hide)return;
        const profile=await this.client.from('profiles').select('circle_moderation_status').eq('id',report.reported_user_id).maybeSingle();
        if(!profile.error&&profile.data?.circle_moderation_status==='hidden')return;
      }
      throw error;
    }
  }
  async curate(feelingId: number, needId: number, ids: number[]) {
    validateCuration(ids);
    await this.rpc("replace_curation", {
      p_feeling_id: feelingId,
      p_need_id: needId,
      p_practice_ids: ids,
    });
  }
  async reorderFeelings(ids: number[]) {
    await this.rpc("reorder_feelings", { p_feeling_ids: ids });
  }
  async signedUrl(bucket: string, path: string) {
    await this.checkAccess();
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, 7200);
    fail(error);
    return data!.signedUrl;
  }
  private async upload(
    bucket: string,
    path: string,
    file: File,
    operationID: string,
    contentType: string,
  ) {
    const body = { operationID, bucket, path };
    const result = await this.edge("admin-shared-media-upload", {
      ...body,
      action: "create",
    });
    if (result?.upload?.bucket !== bucket || result?.upload?.path !== path)
      throw new Error("The upload response did not match this file.");
    if (result.status === "complete") return;
    if (result.status !== "upload_ready" || !result.upload.token)
      throw new Error("Could not prepare the upload.");
    const { error } = await this.client.storage
      .from(bucket)
      .uploadToSignedUrl(path, result.upload.token, file, {
        contentType,
        upsert: false,
      });
    if (error) {
      const exists = await this.client.storage.from(bucket).exists(path);
      if (exists.error || !exists.data) fail(error);
    }
    const final = await this.edge("admin-shared-media-upload", {
      ...body,
      action: "finalize",
    });
    if (
      final?.status !== "complete" ||
      final?.upload?.path !== path ||
      final?.upload?.bucket !== bucket
    )
      throw new Error(
        "The upload has not been validated. Retry the same file.",
      );
  }
  async uploadAudio(practice: Practice, file: File, operationId: string) {
    await this.checkAccess();
    const { extension, mime, duration } = await inspectAudio(file);
    const path = `practices/${practice.id}/audio-${operationId}.${extension}`;
    const current = await this.client
      .from("practices")
      .select("*")
      .eq("id", practice.id)
      .single();
    fail(current.error);
    const payload = {
      audio_path: path,
      duration_sec: duration,
      is_placeholder: false,
      active: false,
    };
    if (isExactCommit(current.data, payload, practice.revision + 1)) return;
    if (
      current.data.revision !== practice.revision ||
      current.data.kind !== "audio"
    )
      throw new Error(conflictMessage);
    await this.upload("practice-audio", path, file, operationId, mime);
    const result = await this.client
      .from("practices")
      .update(payload)
      .eq("id", practice.id)
      .eq("revision", practice.revision)
      .eq("kind", "audio")
      .select("*")
      .single();
    if (result.error) {
      const check = await this.client
        .from("practices")
        .select("*")
        .eq("id", practice.id)
        .single();
      if (
        check.data &&
        isExactCommit(check.data, payload, practice.revision + 1)
      )
        return;
      fail(result.error);
    }
  }
  async uploadImage(week: Week, file: File, operationId: string) {
    const { extension, mime } = await inspectImage(file);
    const path = `weeks/week-${week.week_number}-${operationId}.${extension}`;
    const params = {
      p_operation_id: operationId,
      p_program_week_id: week.id,
      p_week_number: week.week_number,
      p_path: path,
    };
    const started = await this.rpc("begin_program_week_image_upload", params);
    if (started.status === "superseded") throw new Error(conflictMessage);
    if (started.status === "complete") {
      if (started.authoritative_path !== path) throw new Error(conflictMessage);
      return;
    }
    if (started.status !== "upload_required")
      throw new Error("Unexpected artwork upload response. Please refresh.");
    await this.upload("program-media", path, file, operationId, mime);
    const done = await this.rpc("complete_program_week_image_upload", params);
    if (done.status !== "complete" || done.authoritative_path !== path)
      throw new Error(conflictMessage);
  }
  async removeImage(week: Week) {
    await this.rpc("remove_program_week_image", {
      p_program_week_id: week.id,
      p_expected_path: week.image_path,
    });
  }
}
async function inspectImage(file: File) {
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new Error("Choose an image smaller than 8 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = String.fromCharCode(...bytes);
  const format =
    bytes[0] === 0xff && bytes[1] === 0xd8
      ? ["jpg", "image/jpeg"]
      : bytes[0] === 137 && text.slice(1, 4) === "PNG"
        ? ["png", "image/png"]
        : text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"
          ? ["webp", "image/webp"]
          : text.startsWith("GIF8")
            ? ["gif", "image/gif"]
            : null;
  if (!format) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  const bitmap = await createImageBitmap(file);
  const valid =
    bitmap.width <= 8192 &&
    bitmap.height <= 8192 &&
    bitmap.width * bitmap.height <= 40000000;
  bitmap.close();
  if (!valid)
    throw new Error(
      "Images must be at most 8,192 pixels per side and 40 megapixels.",
    );
  return { extension: format[0], mime: format[1] };
}
export async function inspectAudio(file: File) {
  if (!file.size || file.size > MAX_AUDIO_BYTES)
    throw new Error("Choose a recording no larger than 50 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    text = String.fromCharCode(...bytes);
  const format =
    text.startsWith("RIFF") && text.slice(8, 12) === "WAVE"
      ? ["wav", "audio/wav"]
      : text.slice(4, 8) === "ftyp"
        ? ["m4a", "audio/mp4"]
        : text.startsWith("ID3") ||
            (bytes[0] === 255 &&
              (bytes[1] & 0xe0) === 0xe0 &&
              (bytes[1] & 0x06) !== 0)
          ? ["mp3", "audio/mpeg"]
          : null;
  if (!format) throw new Error("Choose a valid MP3, M4A, or WAV recording.");
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      const timer = setTimeout(() => {
        audio.src = "";
        reject(new Error("Could not read this recording."));
      }, 15000);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const value = Math.ceil(audio.duration);
        audio.src = "";
        resolve(value);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        reject(new Error("This recording could not be decoded."));
      };
      audio.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > 36000)
      throw new Error(
        "The recording needs a valid duration below 600 minutes.",
      );
    return { extension: format[0], mime: format[1], duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}
