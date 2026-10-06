# Private gathering and Reset replays

Founders can open a saved gathering or Reset week in web Founder Studio, choose an MP4 in **Upload a private replay**, play its local preview, and upload it. The limit is 500 MB; use H.264 video and AAC audio. Keep the page open. Network interruptions retry automatically; the same file and operation can resume while the editor remains open. Reloading the page requires selecting the file again and starts a new operation.

Videos live in the private `replay-videos` bucket. The application stores a stable `/app/?replay=<uuid>` link and issues a two-hour signed playback URL only after current-member authorization. This is access-controlled streaming, not DRM: an authorized viewer can save or temporarily share the signed media URL. Retiring a gathering or replacing its link prevents new playback URLs; already issued URLs expire within two hours. Reset-week replays are available to current members just like existing Reset content.

`attach_replay` validates the finished object and atomically attaches it using the existing revision check. Retrying a committed operation is idempotent. Existing native apps retain their external **Watch the replay** action; that opens the member web player and may require email-code sign-in in the browser. This does not require an App Store update.

Deployment prerequisite: apply `supabase/migrations/20261006_private_replays.sql` to the Well-Vie project and set its global Storage upload limit to at least 500 MB. Existing buckets retain their smaller limits. This migration adds a bucket/table/functions/policies; it does not rewrite old event or program data.

Verification performed: complete website build; member tests; local editor preview with the supplied H.264/AAC recording; production database permission checks in a rolled-back transaction (draft denial, published member access, detached-media denial, non-member denial, non-admin attach denial). The original uploaded bonus file was verified against its byte count and media type before attachment.
