import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import test from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {config} from '../src/config.ts';
import {uploadReplayFile,validateReplayFile} from '../src/studio/replay-upload.ts';

test('replay selection accepts full-length calls through 3 GB and rejects larger files',()=>{
  const file={name:'Reset call 3.mp4',type:'video/mp4',size:814_136_555};
  for(const size of [file.size,2_147_483_648,3_000_000_000]){
    assert.doesNotThrow(()=>validateReplayFile({...file,size}));
  }
  for(const size of [0,3_000_000_001]){
    assert.throws(()=>validateReplayFile({...file,size}),/up to 3 GB/);
  }
  assert.throws(()=>validateReplayFile({...file,name:'call.mov',type:'video/quicktime'}),/MP4/);
});

test('signed replay upload uses the signed TUS route and sends every chunk', async () => {
  const source=Buffer.alloc(6*1024*1024+123,7);
  const file=Object.assign(source,{name:'call.mp4',size:source.length,lastModified:1,type:'video/mp4'}) as unknown as File;
  const chunks:Buffer[]=[];
  const requests:string[]=[];
  let offset=0;
  const server=createServer(async(req,res)=>{
    requests.push(`${req.method} ${req.url}`);
    if(req.headers['x-signature']!=='signed-upload-token'||!req.url?.startsWith('/storage/v1/upload/resumable/sign')){
      res.writeHead(400).end('Invalid Compact JWS');return;
    }
    const body:Buffer[]=[];
    for await(const chunk of req)body.push(Buffer.from(chunk));
    const bytes=Buffer.concat(body);
    if(req.method==='PATCH')assert.equal(Number(req.headers['upload-offset']),offset);
    chunks.push(bytes);offset+=bytes.length;
    res.setHeader('Tus-Resumable','1.0.0');
    res.setHeader('Upload-Offset',String(offset));
    if(req.method==='POST'){
      assert.equal(Number(req.headers['upload-length']),source.length);
      assert.match(String(req.headers['upload-metadata']),/bucketName cmVwbGF5LXZpZGVvcw==/);
      res.setHeader('Location','/storage/v1/upload/resumable/sign/upload-1');
      res.writeHead(201).end();
    }else res.writeHead(204).end();
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const original=config.supabaseUrl;
  const address=server.address();
  assert.ok(address&&typeof address!=='string');
  (config as {supabaseUrl:string}).supabaseUrl=`http://127.0.0.1:${address.port}`;
  const client={storage:{from:(bucket:string)=>{
    assert.equal(bucket,'replay-videos');
    return {
      list:async()=>({data:[],error:null}),
      createSignedUploadUrl:async(path:string,options:unknown)=>{
        assert.equal(path,'replays/replay-1.mp4');assert.deepEqual(options,{upsert:false});
        return {data:{token:'signed-upload-token'},error:null};
      },
    };
  }}} as unknown as SupabaseClient;
  const progress:number[]=[];
  try{
    await uploadReplayFile(client,file,'replay-1',value=>progress.push(value));
    assert.deepEqual(requests,['POST /storage/v1/upload/resumable/sign','PATCH /storage/v1/upload/resumable/sign/upload-1']);
    assert.ok(Buffer.concat(chunks).equals(source));
    assert.equal(progress.at(-1),100);
  }finally{
    (config as {supabaseUrl:string}).supabaseUrl=original;
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
