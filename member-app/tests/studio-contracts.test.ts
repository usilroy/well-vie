import test from "node:test";
import assert from "node:assert/strict";
import {
  payloadFor,
  httpsUrl,
  validateCuration,
  validateInvite,
  isExactCommit,
} from "../src/studio/validation.ts";
const base = {
  title: "A pause",
  kind: "audio",
  need_slug: "ground",
  description: "",
  duration_sec: 300,
  is_placeholder: true,
  audio_path: null,
  body_text: null,
  active: false,
  creation_token: "54874360-5a75-431d-92cc-e3289289390c",
};
test("incomplete recordings cannot become member-visible", () => {
  for (const patch of [
    { is_placeholder: true, audio_path: "practices/1/final.mp3" },
    { is_placeholder: false, audio_path: null },
    { is_placeholder: false, audio_path: "placeholder-test.mp3" },
    {
      is_placeholder: false,
      audio_path: "practices/1/final.mp3",
      duration_sec: 0,
    },
  ])
    assert.throws(
      () => payloadFor("practices", { ...base, ...patch, active: true }),
      /final recording/,
    );
  const ready = payloadFor("practices", {
    ...base,
    active: true,
    is_placeholder: false,
    audio_path: "practices/1/final.mp3",
  });
  assert.equal(ready.active, true);
});
test("text publication needs instructions and drops stale audio ownership", () => {
  assert.throws(
    () => payloadFor("practices", { ...base, kind: "text", active: true }),
    /instructions/,
  );
  const result = payloadFor("practices", {
    ...base,
    kind: "text",
    body_text: "  Breathe gently.  ",
    active: true,
    audio_path: "old.mp3",
  });
  assert.equal(result.body_text, "Breathe gently.");
  assert.equal(result.audio_path, null);
  assert.equal(result.is_placeholder, false);
});
test("week editor never writes image path or revision owned by the backend", () => {
  const result = payloadFor("program_weeks", {
    id: 1,
    revision: 4,
    title: "Arrive",
    week_number: 2,
    notes: "",
    image_path: "malicious-overwrite.jpg",
    is_admin: true,
    call_replay_url: "",
    creation_token: "old",
  });
  assert.equal("image_path" in result, false);
  assert.equal("revision" in result, false);
  assert.equal("is_admin" in result, false);
  assert.equal("creation_token" in result, false);
  assert.equal(result.call_replay_url, null);
  assert.throws(
    () =>
      payloadFor("program_weeks", {
        title: "Test",
        week_number: 53,
        creation_token: "new",
      }),
    /1 to 52/,
  );
});
test("all existing editors require a version; retries require an exact next revision", () => {
  assert.throws(() => payloadFor("practices", { ...base, id: 1 }), /Refresh/);
  const payload = { title: "A pause", active: true };
  assert.equal(isExactCommit({ ...payload, revision: 5 }, payload, 5), true);
  assert.equal(isExactCommit({ ...payload, revision: 6 }, payload, 5), false);
  assert.equal(
    isExactCommit(
      { ...payload, title: "Another edit", revision: 5 },
      payload,
      5,
    ),
    false,
  );
});
test("unsafe links and malformed curation are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
  ])
    assert.throws(() => httpsUrl(url));
  assert.equal(
    httpsUrl("https://example.com/room"),
    "https://example.com/room",
  );
  assert.equal(httpsUrl(""), null);
  for (const ids of [[1, 1], [1, 2, 3, 4], [0], [-1], [1.5]])
    assert.throws(() => validateCuration(ids));
  assert.doesNotThrow(() => validateCuration([3, 1]));
  assert.doesNotThrow(() => validateCuration([]));
});
test("invitation input is normalized and bounded", () => {
  assert.equal(
    validateInvite("Member", "  Person@Example.com "),
    "person@example.com",
  );
  assert.throws(() => validateInvite("", "x@example.com"));
  assert.throws(() => validateInvite("A".repeat(81), "x@example.com"));
  assert.throws(() => validateInvite("Person", "x@y"));
});

import { LiveRepository } from "../src/studio/repository.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
test("non-admin identities cannot read admin tables or invoke writes", async () => {
  let reads = 0,
    writes = 0;
  const client = {
    rpc: async () => ({
      data: { id: "member-id", isAdmin: false },
      error: null,
    }),
    from: () => {
      reads++;
      throw new Error("unexpected table access");
    },
    functions: {
      invoke: () => {
        writes++;
        throw new Error("unexpected write");
      },
    },
  };
  const repo = new LiveRepository(client as unknown as SupabaseClient);
  await assert.rejects(repo.load(), /administrator access/);
  await assert.rejects(
    repo.invite("A", "a@example.com", false),
    /administrator access/,
  );
  await assert.rejects(repo.save("practices", base), /administrator access/);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});
test("database failures never fall back to the demo or bypass authorization", async () => {
  const repo = new LiveRepository({
    rpc: async () => ({ data: null, error: { message: "Session expired" } }),
  } as unknown as SupabaseClient);
  await assert.rejects(repo.load(), /Session expired/);
});
test("a lost update response recovers only the exact committed revision", async () => {
  const payload = payloadFor("practices", { ...base, id: 1, revision: 2 });
  const makeClient = (row: object) => ({
    rpc: async () => ({ data: { id: "admin-id", isAdmin: true }, error: null }),
    from: () => ({
      update: () => {
        const chain = {
          eq: () => chain,
          select: () => chain,
          single: async () => ({
            data: null,
            error: { message: "Response lost" },
          }),
        };
        return chain;
      },
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    }),
  });
  const recovered = new LiveRepository(
    makeClient({ ...payload, id: 1, revision: 3 }) as unknown as SupabaseClient,
  );
  assert.equal(
    (await recovered.save("practices", { ...base, id: 1, revision: 2 }))
      .revision,
    3,
  );
  const conflict = new LiveRepository(
    makeClient({ ...payload, id: 1, revision: 4 }) as unknown as SupabaseClient,
  );
  await assert.rejects(
    conflict.save("practices", { ...base, id: 1, revision: 2 }),
    /changed since/,
  );
});

import { MAX_AUDIO_BYTES, authenticatedFetch } from "../src/studio/transport.ts";
test("recording size matches the deployed 50 MiB storage contract", () => {
  assert.equal(MAX_AUDIO_BYTES, 52_428_800);
});
test("transport preserves upstream aborts and disables caching", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  controller.abort(new Error("Cancelled"));
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.signal?.aborted, true);
    throw init?.signal?.reason;
  };
  try {
    await assert.rejects(
      authenticatedFetch("https://example.supabase.co/rest/v1/profiles", {
        signal: controller.signal,
      }),
      /Cancelled/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("transport preserves empty mutation responses and headers", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, { status: 204, headers: { "x-request-id": "123" } });
  try {
    const response = await authenticatedFetch(
      "https://example.supabase.co/rest/v1/practices",
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("x-request-id"), "123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a stalled response body is aborted instead of leaving the workspace loading', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => ({
    arrayBuffer: () => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }),
  }) as Response;
  try {
    const pending = authenticatedFetch('https://example.supabase.co/rest/v1/profiles');
    const rejected = assert.rejects(pending, /timed out/);
    await Promise.resolve();
    t.mock.timers.tick(30_000);
    await rejected;
  } finally { globalThis.fetch = originalFetch; t.mock.timers.reset(); }
});

test('oversized audio is rejected before bytes are read', async () => {
  const { inspectAudio } = await import('../src/studio/repository.ts');
  let reads = 0;
  const file = { size: MAX_AUDIO_BYTES + 1, slice: () => { reads++; throw new Error('Unexpected read'); } } as unknown as File;
  await assert.rejects(inspectAudio(file), /50 MB/);
  assert.equal(reads, 0);
});

test('all privileged mutations reject a non-admin before contacting their endpoint', async () => {
  let invoked = 0;
  const client = {
    rpc: async (name: string) => { if (name !== 'current_member_context') invoked++; return { data: { id: 'member', isAdmin: false }, error: null }; },
    functions: { invoke: () => { invoked++; throw new Error('Unexpected edge invocation'); } },
    storage: { from: () => { invoked++; throw new Error('Unexpected storage access'); } },
  };
  const repo = new LiveRepository(client as unknown as SupabaseClient);
  for (const action of [
    () => repo.memberAction('role', 'other', 'admin'),
    () => repo.memberAction('remove', 'other'),
    () => repo.memberAction('revoke', 'a@example.com'),
    () => repo.curate(1, 1, [1]),
    () => repo.reorderFeelings([1, 2]),
    () => repo.signedUrl('practice-audio', 'private.mp3'),
  ]) await assert.rejects(action(), /administrator access/);
  assert.equal(invoked, 0);
});

import { classifyAudio } from '../src/studio/inventory.ts';
import type { Member, Report } from '../src/studio/types.ts';
test('recording inventory preserves references and treats uncertain ages conservatively', () => {
  const rows = [
    {path:'used.mp3',createdAt:'2026-01-01'},
    {path:'old.mp3',createdAt:'2026-09-01'},
    {path:'recent.mp3',createdAt:'2026-10-01'},
    {path:'unknown.mp3',createdAt:null},
    {path:'invalid.mp3',createdAt:'bad date'},
    {path:'future.mp3',createdAt:'2027-01-01'},
  ];
  const result=classifyAudio([...rows,rows[1]],new Set(['used.mp3']),new Date('2026-10-02T00:00:00Z'));
  assert.equal(result.scanned,6);assert.equal(result.referenced,1);
  assert.deepEqual(result.candidates.map(x=>x.path),['old.mp3']);
  assert.deepEqual(result.recent.map(x=>x.path),['recent.mp3','future.mp3']);
  assert.deepEqual(result.unknown.map(x=>x.path),['unknown.mp3','invalid.mp3']);
});
const reviewMember={id:'reviewed',circle_content_revision:3,circle_moderation_version:2} as Member;
const reviewReport={id:'report',reported_user_id:'reviewed',resolution_version:4} as Report;
function moderationClient(profile:object, report:object, admin=true){
  return {
    rpc: async(name:string)=>name==='current_member_context'?{data:{id:'admin',isAdmin:admin},error:null}:{data:null,error:{message:'Lost moderation response'}},
    from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='profiles'?profile:report,error:null})})})}),
  } as unknown as SupabaseClient;
}
test('profile review reconciles a lost response only for the exact content and moderation revision',async()=>{
  const exact={circle_content_revision:3,circle_moderation_version:3,circle_moderation_status:'approved',circle_moderation_note:null};
  await new LiveRepository(moderationClient(exact,{})).moderate(reviewMember,'approved','');
  for(const patch of [{circle_content_revision:4},{circle_moderation_version:4},{circle_moderation_status:'hidden'},{circle_moderation_note:'Another moderator'}]){
    await assert.rejects(new LiveRepository(moderationClient({...exact,...patch},{})).moderate(reviewMember,'approved',''),/Lost moderation response/);
  }
});
test('report retry confirms the exact resolution and requested profile hiding',async()=>{
  const report={resolution_version:5,status:'resolved',profile_hidden:true,resolution_note:'Reviewed'};
  await new LiveRepository(moderationClient({circle_moderation_status:'hidden'},report)).resolve(reviewReport,'resolved','Reviewed',true);
  await assert.rejects(new LiveRepository(moderationClient({circle_moderation_status:'approved'},report)).resolve(reviewReport,'resolved','Reviewed',true),/Lost moderation response/);
  await assert.rejects(new LiveRepository(moderationClient({}, {...report,resolution_version:6})).resolve(reviewReport,'resolved','Reviewed',true),/Lost moderation response/);
});
test('moderation denial does not attempt reconciliation or read private tables',async()=>{
  const client=moderationClient({}, {},false);
  client.from=()=>{throw new Error('Unexpected table access');};
  const repo=new LiveRepository(client);
  await assert.rejects(repo.moderate(reviewMember,'approved',''),/administrator access/);
  await assert.rejects(repo.resolve(reviewReport,'dismissed','',false),/administrator access/);
});
test('Studio paginates full admin lists and never requests member journals or private histories',async()=>{
  const tables=new Set<string>();const pages:number[]=[];let checks=0;
  const client={rpc:async(name:string)=>{if(name==='current_member_context'){checks++;return {data:{id:'admin',isAdmin:true},error:null};}return {data:[],error:null};},from:(table:string)=>{
    tables.add(table);return {select:()=>({order:()=>({range:async(start:number)=>{
      if(table==='profiles')pages.push(start);
      return {data:table==='profiles'?(start===0?Array.from({length:500},(_,id)=>({id})): [{id:501}]):[],error:null};
    }})})};
  }};
  const result=await new LiveRepository(client as unknown as SupabaseClient).load();
  assert.equal(result.data.members.length,501);assert.deepEqual(pages,[0,500]);assert.equal(checks,2);
  assert.deepEqual([...tables].sort(),['profiles','member_invites','practices','feelings','needs','program_weeks','events','member_reports','intake_responses','curation_map','prompts'].sort());
});
test('revoked founder access during a load discards the fetched snapshot',async()=>{
  let checks=0;const client={rpc:async(name:string)=>({data:name==='current_member_context'?{id:'admin',isAdmin:++checks===1}:[],error:null}),from:()=>({select:()=>({order:()=>({range:async()=>({data:[],error:null})})})})};
  await assert.rejects(new LiveRepository(client as unknown as SupabaseClient).load(),/administrator access/);
});

test('private replay upload rejects a non-admin before requesting any storage access',async()=>{
  const {LiveRepository}=await import('../src/studio/repository.ts');
  const client={rpc:async()=>({data:{id:'member',isAdmin:false},error:null}),get storage(){throw new Error('Storage must not be accessed');}};
  const repo=new LiveRepository(client as any);
  await assert.rejects(repo.uploadReplay('events',{id:2,revision:1},{} as File,'upload',1745,()=>{}),/administrator access/);
});
