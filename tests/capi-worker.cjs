// Requires temporary/dev tooling: npm install --prefix /tmp/rumble-capi-tooling wrangler
// RUMBLE_TEST_TOOLING=/tmp/rumble-capi-tooling node tests/capi-worker.cjs
// Uses real local workerd + D1. ALL outgoing requests are mocked; no real secrets/events/mail.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const tooling=process.env.RUMBLE_TEST_TOOLING || '/tmp/rumble-capi-tooling';
const {Miniflare,convertV4MiniflareOptions,Response:MFResponse}=createRequire(path.join(tooling,'package.json'))('miniflare');
const {randomUUID,createHash}=require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'deploy/rumble-api.js'),'utf8');
const wrapped=source.replace('export default {','const app = {')+`
export default { async fetch(request,env,ctx) {
 if(new URL(request.url).pathname==='/__test_cron') { await app.scheduled({},env,ctx); return new Response('ok'); }
 return app.fetch(request,env,ctx);
}};`;
let graphMode='success', metaCalls=[],emails=0;
const response=(body,status=200)=>new MFResponse(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:wrapped,compatibilityDate:'2026-10-20',d1Databases:['DB'],
  bindings:{META_CAPI_ENABLED:'true',META_PIXEL_ID:'1328602995881864',META_GRAPH_API_VERSION:'v25.0',META_ACCESS_TOKEN:'DUMMY_TEST_TOKEN',META_TEST_EVENT_CODE:'TEST_LOCAL_ONLY',
    MS_TENANT_ID:'DUMMY',MS_CLIENT_ID:'DUMMY',MS_CLIENT_SECRET:'DUMMY',EMAIL_FROM_USER:'test@example.com',EMAIL_TO:'offline@example.com'},
  outboundService:async request=>{
    const url=new URL(request.url);
    if(url.hostname==='graph.facebook.com'){
      const payload=await request.json();metaCalls.push({url:url.href,auth:request.headers.get('Authorization'),payload});
      if(graphMode==='server_error')return response({error:{code:2,is_transient:true}},503);
      if(graphMode==='invalid')return response({error:{code:100}},400);
      return response({events_received:1});
    }
    if(url.hostname==='login.microsoftonline.com')return response({access_token:'DUMMY_MS_TOKEN'});
    if(url.hostname==='graph.microsoft.com'){emails++;return new MFResponse(null,{status:202});}
    throw Error('Unexpected external request: '+url.hostname);
  }
}));
const form=(changes={})=>{
 const id=randomUUID();return {name:'Offline Worker Test',contact:'User.Name@example.com',enquiry_type:'Parts',message:'Offline worker integration check',page:'https://www.rumbleauto.com.au/?private=omit#form',
 idempotency_key:id,event_id:id,meta_test:true,tracking_consent:{version:3,marketing:true},meta_fbp:'fb.1.1792450000000.123456789',meta_fbc:'fb.1.1792450000000.RealClickId',...changes};
};
const post=async body=>{
 const res=await mf.dispatchFetch('https://api.rumbleauto.com.au/',{method:'POST',headers:{Origin:'https://www.rumbleauto.com.au','Content-Type':'application/json','CF-Connecting-IP':'203.0.113.1','User-Agent':'Offline CAPI Test'},body:JSON.stringify(body)});
 return {status:res.status,body:await res.json()};
};
async function eventually(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out waiting for background job');}
let db;
const row=id=>db.prepare('SELECT * FROM meta_capi_outbox WHERE event_id=?').bind(id).first();
(async()=>{
 await mf.ready;db=await mf.getD1Database('DB');
 await db.exec('CREATE TABLE enquiries (id INTEGER PRIMARY KEY, name TEXT,contact TEXT,enquiry_type TEXT,preferred_model TEXT,message TEXT,page TEXT,ip TEXT,user_agent TEXT);');
 // D1.exec expects one complete SQL statement per line.
 const migration=fs.readFileSync(path.join(root,'deploy/migrations/0001_lead_idempotency_capi.sql'),'utf8').replace(/^--.*$/gm,'').split(';').map(x=>x.trim()).filter(Boolean);
 for(const sql of migration)await db.prepare(sql).run();
 const payload=form();
 const concurrent=await Promise.all(Array.from({length:8},()=>post(payload)));
 assert(concurrent.every(x=>x.status===200 && x.body.event_id===payload.event_id));
 assert.equal(concurrent.filter(x=>!x.body.duplicate).length,1);
 assert.equal(await db.prepare('SELECT COUNT(*) n FROM enquiries').first('n'),1);
 await eventually(async()=> (await row(payload.event_id))?.status==='sent' && emails===1);
 assert.equal(metaCalls.length,1);assert.equal(emails,1);
 const call=metaCalls[0];assert(!call.url.includes('TOKEN'));assert.equal(call.auth,'Bearer DUMMY_TEST_TOKEN');
 const event=call.payload.data[0];
 assert.equal(event.event_id,payload.event_id);assert.equal(event.event_name,'Lead');assert.equal(event.custom_data.lead_type,'Parts');
 assert.equal(event.event_source_url,'https://www.rumbleauto.com.au/');assert.equal(event.user_data.client_ip_address,'203.0.113.1');
 assert.equal(event.user_data.em[0],createHash('sha256').update('user.name@example.com').digest('hex'));
 assert.equal(event.user_data.fbp,payload.meta_fbp);assert.equal(event.user_data.fbc,payload.meta_fbc);
 assert.equal(call.payload.test_event_code,'TEST_LOCAL_ONLY');assert(!JSON.stringify(call).includes(payload.contact));
 assert.equal((await row(payload.event_id)).payload_json,null);
 assert.equal((await post({...payload,message:'Different content with same key'})).status,409);
 assert.equal(await db.prepare('SELECT COUNT(*) n FROM enquiries').first('n'),1);

 // Denied/missing/legacy consent save enquiries normally without CAPI or invented cookies.
 for(const consent of [undefined,{version:3,marketing:false},{version:2,marketing:true},{version:3,marketing:'true'}]){
  const p=form({tracking_consent:consent});assert.equal((await post(p)).status,200);assert.equal(await row(p.event_id),null);
 }
 assert.equal(metaCalls.length,1);
 const phone=form({contact:'0412 345 678',meta_fbp:'invalid',meta_fbc:undefined});
 await post(phone);await eventually(async()=> (await row(phone.event_id))?.status==='sent');
 const phoneEvent=metaCalls.at(-1).payload.data[0];
 assert.equal(phoneEvent.user_data.ph[0],createHash('sha256').update('61412345678').digest('hex'));
 assert.equal(phoneEvent.user_data.fbp,undefined);assert.equal(phoneEvent.user_data.fbc,undefined);

 // Only explicitly marked tests use the environment test-event code.
 const ordinary=form({meta_test:false});await post(ordinary);
 await eventually(async()=> (await row(ordinary.event_id))?.status==='sent');
 assert.equal(metaCalls.at(-1).payload.test_event_code,undefined);

 // Transient error persists job; concurrent cron attempts use a lease; retry reuses the ID.
 graphMode='server_error';const retry=form();assert.equal((await post(retry)).status,200);
 await eventually(async()=> (await row(retry.event_id))?.last_error==='HTTP_503_CODE_2');
 assert.equal((await row(retry.event_id)).status,'pending');
 graphMode='success';await db.prepare('UPDATE meta_capi_outbox SET next_attempt_ms=0 WHERE event_id=?').bind(retry.event_id).run();
 await Promise.all(Array.from({length:3},()=>mf.dispatchFetch('https://api.rumbleauto.com.au/__test_cron')));
 await eventually(async()=> (await row(retry.event_id))?.status==='sent');
 assert.equal(metaCalls.filter(x=>x.payload.data[0].event_id===retry.event_id).length,2);
 assert.equal((await row(retry.event_id)).attempts,2);

 graphMode='invalid';const bad=form();await post(bad);
 await eventually(async()=> (await row(bad.event_id))?.status==='failed');
 assert.equal((await row(bad.event_id)).last_error,'HTTP_400_CODE_100');
 assert.equal((await post(bad)).body.duplicate,true);
 assert.equal(metaCalls.filter(x=>x.payload.data[0].event_id===bad.event_id).length,1);
 await db.prepare('UPDATE meta_capi_outbox SET created_at_ms=0 WHERE event_id=?').bind(bad.event_id).run();
 await mf.dispatchFetch('https://api.rumbleauto.com.au/__test_cron');
 await eventually(async()=> (await row(bad.event_id))?.status==='expired');assert.equal((await row(bad.event_id)).payload_json,null);

 // Rejected input and origin must not insert anything.
 const before=await db.prepare('SELECT COUNT(*) n FROM enquiries').first('n');
 assert.equal((await post(null)).status,400);assert.equal((await post(form({name:''}))).status,400);
 const blocked=await mf.dispatchFetch('https://api.rumbleauto.com.au/',{method:'POST',headers:{Origin:'https://other.example'},body:JSON.stringify(form())});assert.equal(blocked.status,403);
 assert.equal(await db.prepare('SELECT COUNT(*) n FROM enquiries').first('n'),before);

 // Simulate an insert error: the transaction must roll back its idempotency reservation.
 await db.exec("CREATE TRIGGER fail_lead BEFORE INSERT ON enquiries BEGIN SELECT RAISE(ABORT,'test failure'); END;");
 const rollback=form();assert.equal((await post(rollback)).status,500);
 assert.equal(await db.prepare('SELECT COUNT(*) n FROM enquiry_requests WHERE request_key=?').bind(rollback.idempotency_key).first('n'),0);
 await db.exec('DROP TRIGGER fail_lead;');
 graphMode='success';assert.equal((await post(rollback)).status,200);
 await eventually(async()=> (await row(rollback.event_id))?.status==='sent');
 console.log('PASS: real local D1 concurrency/idempotency/rollback; consent; Meta payloads/hashing/IDs; email once; leased retries; permanent errors; payload expiry; origin/input validation.');
})().finally(()=>mf.dispose()).catch(error=>{console.error(error);process.exitCode=1;});
