Deno.env.set('RESEND_API_KEY', 'test-key-not-a-real-secret');
Deno.env.set('WELL_VIE_RECIPIENT_EMAIL', 'team@example.test');
const originalServe = Deno.serve;
let registeredHandler: unknown;
Deno.serve = ((handler: unknown) => { registeredHandler = handler; }) as typeof Deno.serve;
let module: typeof import('./index.ts');
try { module = await import('./index.ts'); } finally { Deno.serve = originalServe; }
const { handleFormRequest, validateFormPrivacy } = module;
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
function form(extra: Record<string,string> = {}) { const f = new FormData(); for (const [k,v] of Object.entries({form_type:'reset_application','Full Name':'Privacy test',email:'member@example.test',Age:'30',Location:'Test country',...extra})) f.set(k,v); return f; }
function request(f: FormData) { return new Request('https://forms.example.test', {method:'POST', body:f}); }
Deno.test('entrypoint registers the production request handler', () => equal(registeredHandler === handleFormRequest, true));
Deno.test('contact-only application does not require wellbeing consent', () => equal(validateFormPrivacy(form(),'reset_application'),null));
Deno.test('sensitive answers need current, unambiguous explicit consent', () => {
 const f = form({'Current support needed':'Private test answer'});
 equal(Boolean(validateFormPrivacy(f,'reset_application')),true);
 f.set('wellbeing_consent','yes'); f.set('wellbeing_consent_version','old');
 equal(Boolean(validateFormPrivacy(f,'reset_application')),true);
 f.set('wellbeing_consent_version','2026-10-02'); equal(validateFormPrivacy(f,'reset_application'),null);
 f.append('wellbeing_consent','no'); equal(Boolean(validateFormPrivacy(f,'reset_application')),true);
});
Deno.test('unknown fields and uploaded files are refused', () => {
 equal(Boolean(validateFormPrivacy(form({medical_records:'should not pass'}),'reset_application')),true);
 const f=form();f.set('Full Name',new Blob(['not an allowed file']),'test.txt');equal(Boolean(validateFormPrivacy(f,'reset_application')),true);
});
Deno.test('invalid consent never sends mail, and valid consent is recorded with server text/time', async () => {
 const original=globalThis.fetch;const sent: Record<string,string>[]=[];
 globalThis.fetch=async (_url,options)=>{sent.push(JSON.parse(String(options?.body)));return new Response('{}',{status:200});};
 try {
  let res=await handleFormRequest(request(form({'Why now':'private test'})));equal(res.status,400);equal(sent.length,0);
  res=await handleFormRequest(request(form({'Why now':'private test',wellbeing_consent:'yes',wellbeing_consent_version:'2026-10-02',wellbeing_consent_text:'forged'})));
  equal(res.status,303);equal(res.headers.get('Location'),'https://www.well-vie.com/reset/application-confirmation/');equal(sent.length,2);
  equal(sent[0].text.includes('I explicitly consent'),true);equal(sent[0].text.includes('wellbeing_consent_recorded_at'),true);equal(sent[0].text.includes('forged'),false);
  equal(sent[1].text.includes('private test'),false);
 } finally {globalThis.fetch=original;}
});
Deno.test('contacts-only and waitlist still deliver, arbitrary redirects are not used',async()=>{
 const original=globalThis.fetch;let count=0;globalThis.fetch=async()=>{count++;return new Response('{}',{status:200});};
 try {
  const res=await handleFormRequest(request(form({redirect_url:'https://evil.example.test/'})));equal(res.status,303);equal(res.headers.get('Location'),'https://www.well-vie.com/reset/application-confirmation/');
  const f=new FormData();for(const[k,v]of Object.entries({form_type:'ecosystem_waitlist','First Name':'Test','Last Name':'Person',email:'test@example.test',Country:'Test',waitlist_notice_version:'2026-10-02'}))f.set(k,v);
  const wait=await handleFormRequest(request(f));equal(wait.status,303);equal(wait.headers.get('Location'),'https://www.well-vie.com/ecosystem/waitlist-confirmation/');equal(count,4);
 }finally{globalThis.fetch=original;}
});
Deno.test('provider failures do not log private response content',async()=>{
 const original=globalThis.fetch;const log=console.error;const messages:unknown[]=[];
 globalThis.fetch=async()=>new Response('private-provider-response',{status:500});console.error=(...a)=>{messages.push(a);};
 try {const res=await handleFormRequest(request(form()));equal(res.status,500);equal(JSON.stringify(messages).includes('private-provider-response'),false);}finally{globalThis.fetch=original;console.error=log;}
});
