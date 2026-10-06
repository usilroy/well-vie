# Gathering RSVP

Members can choose Going, Maybe or Can’t make it on an upcoming Gathering, change their response, or clear it. The response is private to that member and Well-Vie administrators. Going/Maybe also offers a calendar file. Joining the call does not require an RSVP.

Founder Studio → Gatherings → View RSVPs shows counts and a searchable list with Load more (20 per request). No reply means current non-admin members without a response; admins only appear after responding themselves. Gatherings currently have a shared membership audience, not per-circle attendance. No email, SMS or push reminders are sent.

Responses are tied to the call’s start instant, not an event revision: editing its description or adding a replay preserves them. Rescheduling requires confirmation again. The server rejects stale dates, unavailable/past events, nonmembers and attempts to choose another member’s identity. Responses cascade on member/event deletion.

Apply `supabase/migrations/20261006_gathering_rsvp.sql` before deploying the web app. The rollback-only security test is `supabase/tests/gathering_rsvp.sql`. Existing native clients are unchanged; RSVP is web-only until included in a later native update. No App Store submission accompanies this change.
