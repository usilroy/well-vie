import type { Draft, EditableTable } from "./types.ts";
export const conflictMessage =
  "This record changed since you opened it. Close the editor, refresh, and try again.";
const fields: Record<EditableTable, string[]> = {
  practices: [
    "title",
    "need_slug",
    "kind",
    "description",
    "body_text",
    "audio_path",
    "duration_sec",
    "is_placeholder",
    "active",
  ],
  feelings: ["slug", "label", "sort_order", "active"],
  program_weeks: [
    "week_number",
    "title",
    "notes",
    "call_replay_url",
    "breathwork_practice_id",
    "somatic_practice_id",
    "prompt_ids",
  ],
  events: [
    "title",
    "kind",
    "description",
    "starts_at",
    "duration_min",
    "join_url",
    "replay_url",
    "active",
  ],
};
export function httpsUrl(value: unknown) {
  if (!value) return null;
  const url = new URL(String(value).trim());
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("Use a valid HTTPS link.");
  return url.href;
}
export function payloadFor(
  table: EditableTable,
  draft: Draft,
): Record<string, unknown> {
  const payload = Object.fromEntries(
    fields[table]
      .filter((k) => k in draft)
      .map((k) => [
        k,
        typeof draft[k] === "string" ? (draft[k] as string).trim() : draft[k],
      ]),
  );
  const title = table === "feelings" ? payload.label : payload.title;
  if (typeof title !== "string" || !title || title.length > 120)
    throw new Error("Enter a title between 1 and 120 characters.");
  if (
    draft.id != null &&
    (!Number.isInteger(draft.revision) || draft.revision! < 0)
  )
    throw new Error("Refresh this record before editing.");
  if (draft.id == null) {
    if (!draft.creation_token)
      throw new Error("Missing creation token. Reopen this editor.");
    payload.creation_token = draft.creation_token;
  }
  if (table === "practices") {
    if (!["audio", "text"].includes(String(payload.kind)) || !payload.need_slug)
      throw new Error("Choose a format and a need.");
    const duration = Number(payload.duration_sec || 0);
    if (!Number.isInteger(duration) || duration < 0 || duration > 36000)
      throw new Error("Duration must be between 0 and 36,000 seconds.");
    payload.duration_sec = duration || null;
    if (payload.kind === "text") {
      payload.audio_path = null;
      payload.is_placeholder = false;
    } else {
      payload.body_text = null;
      payload.is_placeholder =
        !!payload.is_placeholder ||
        !payload.audio_path ||
        String(payload.audio_path).startsWith("placeholder-");
    }
    if (
      payload.active &&
      payload.kind === "audio" &&
      (payload.is_placeholder || !payload.audio_path || !duration)
    )
      throw new Error(
        "Upload a final recording with a valid duration before publishing.",
      );
    if (payload.active && payload.kind === "text" && !payload.body_text)
      throw new Error("Add the practice instructions before publishing.");
  }
  if (table === "feelings") {
    payload.slug = String(payload.label)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!payload.slug) throw new Error("The feeling needs a valid label.");
  }
  if (table === "program_weeks") {
    if (
      !Number.isInteger(payload.week_number) ||
      Number(payload.week_number) < 1 ||
      Number(payload.week_number) > 52
    )
      throw new Error("Choose a week from 1 to 52.");
    payload.call_replay_url = httpsUrl(payload.call_replay_url);
  }
  if (table === "events") {
    if (
      ![
        "workshop",
        "breathwork",
        "call",
        "guest",
        "retreat",
        "gathering",
      ].includes(String(payload.kind))
    )
      throw new Error("Choose a gathering type.");
    if (!Number.isFinite(Date.parse(String(payload.starts_at))))
      throw new Error("Choose a valid date and time.");
    payload.starts_at = new Date(String(payload.starts_at)).toISOString();
    if (
      payload.duration_min != null &&
      (!Number.isInteger(payload.duration_min) ||
        Number(payload.duration_min) <= 0)
    )
      throw new Error("Duration must be a positive whole number.");
    payload.join_url = httpsUrl(payload.join_url);
    payload.replay_url = httpsUrl(payload.replay_url);
  }
  return payload;
}
export function validateCuration(ids: number[]) {
  if (
    ids.length > 3 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !Number.isInteger(id) || id <= 0)
  )
    throw new Error("Choose up to three different practices.");
}
export function validateInvite(name: string, email: string) {
  if (!name.trim() || name.trim().length > 80)
    throw new Error("Enter a name of up to 80 characters.");
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new Error("Enter a valid email address.");
  return normalized;
}
export function isExactCommit(
  row: Record<string, unknown>,
  payload: Record<string, unknown>,
  revision: number,
) {
  return (
    row.revision === revision &&
    Object.entries(payload).every(
      ([k, v]) => JSON.stringify(row[k]) === JSON.stringify(v),
    )
  );
}
