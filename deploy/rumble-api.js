// Cloudflare Worker: existing D1 enquiry + Microsoft Graph email, with Meta CAPI.
// First apply migrations/0001_lead_idempotency_capi.sql to the existing DB binding.
// Secret: META_ACCESS_TOKEN. Keep the existing Microsoft/email bindings unchanged.
// Variables: META_CAPI_ENABLED="true", META_PIXEL_ID="1328602995881864",
// META_GRAPH_API_VERSION="v25.0". Optional: META_TEST_EVENT_CODE during testing only.
// Add a */5 * * * * Cron Trigger for durable CAPI retries.

const SITE_ORIGINS = new Set(['https://www.rumbleauto.com.au', 'https://rumbleauto.com.au']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 8;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (SITE_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
    if (origin && !SITE_ORIGINS.has(origin)) return reply({ok:false,error:'Origin not allowed'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return reply({ok:false,error:'Method not allowed'},405);

    try {
      // Bound the body even when Content-Length is absent or untrusted.
      const raw = await readBoundedBody(request, 32768);
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) return reply({ok:false,error:"Invalid form data"},400);
      const fields = {};
      for (const [key, limit] of Object.entries({name:200,contact:320,enquiry_type:80,preferred_model:300,message:10000,page:2048})) {
        if (data[key] != null && typeof data[key] !== 'string') return reply({ok:false,error:'Invalid form fields'},400);
        fields[key] = (data[key] || '').trim();
        if (fields[key].length > limit) return reply({ok:false,error:'Form field too long'},400);
      }
      if (!fields.name || !fields.contact || !fields.enquiry_type || !fields.message) return reply({ok:false,error:'Missing required fields'},400);
      const rawKey = data.idempotency_key;
      if (rawKey != null && (typeof rawKey !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(rawKey))) return reply({ok:false,error:'Invalid request key'},400);
      if (data.event_id != null && (typeof data.event_id !== 'string' || !UUID.test(data.event_id))) return reply({ok:false,error:'Invalid event ID'},400);
      const requestKey = rawKey || crypto.randomUUID();
      const eventId = data.event_id || crypto.randomUUID();
      // Exclude timestamp/consent/cookie changes from retry identity; the form content must match.
      const payloadHash = await sha256(JSON.stringify(fields));
      const owner = crypto.randomUUID();
      const now = Date.now();
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const userAgent = request.headers.get('User-Agent') || '';
      const allowed = data.tracking_consent?.version === 3 && data.tracking_consent?.marketing === true;
      let capiEvent = null;
      if (allowed && env.META_CAPI_ENABLED === 'true' && env.META_ACCESS_TOKEN) {
        try { capiEvent = await buildMetaEvent(fields, data, eventId, now, ip, userAgent); }
        catch { log('CAPI_PREPARE_FAILED'); } // Matching cannot prevent the enquiry being saved.
      }
      const statements = [
        env.DB.prepare(`INSERT INTO enquiry_requests (request_key,payload_hash,event_id,owner_token,created_at_ms)
          VALUES (?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING`).bind(requestKey,payloadHash,eventId,owner,now),
        env.DB.prepare(`INSERT INTO enquiries (name,contact,enquiry_type,preferred_model,message,page,ip,user_agent)
          SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM enquiry_requests WHERE request_key=? AND owner_token=?)`)
          .bind(fields.name,fields.contact,fields.enquiry_type,fields.preferred_model,fields.message,fields.page,ip,userAgent,requestKey,owner),
      ];
      if (capiEvent) statements.push(env.DB.prepare(`INSERT INTO meta_capi_outbox (event_id,payload_json,test_event_code,next_attempt_ms,created_at_ms)
        SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM enquiry_requests WHERE request_key=? AND owner_token=?)`)
        .bind(eventId,JSON.stringify(capiEvent),data.meta_test === true ? (env.META_TEST_EVENT_CODE || null) : null,now,now,requestKey,owner));
      statements.push(env.DB.prepare('SELECT event_id,payload_hash,owner_token FROM enquiry_requests WHERE request_key=?').bind(requestKey));
      // One atomic D1 batch: no key reservation can survive without the corresponding saved lead.
      const results = await env.DB.batch(statements);
      const saved = results[results.length-1].results[0];
      if (!saved || saved.payload_hash !== payloadHash) return reply({ok:false,error:'Request key already used for different form data'},409);
      const duplicate = saved.owner_token !== owner;
      if (!duplicate) {
        const submitted_at_sydney = new Intl.DateTimeFormat('en-AU', {
          timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,
        }).format(new Date(now));
        ctx.waitUntil(sendEnquiryEmailViaGraph(env,{...fields,ip,user_agent:userAgent,submitted_at_sydney}).catch(() => log('EMAIL_UNAVAILABLE')));
      }
      // Immediate attempt; Cron retries from the durable outbox after a timeout or transient error.
      if (capiEvent && !duplicate) ctx.waitUntil(deliverMetaEvent(env,eventId).catch(() => log('CAPI_BACKGROUND_ERROR')));
      return reply({ok:true,event_id:saved.event_id,duplicate});
    } catch (error) {
      if (error instanceof SyntaxError) return reply({ok:false,error:'Invalid JSON'},400);
      if (error?.message === 'BODY_TOO_LARGE') return reply({ok:false,error:'Request too large'},413);
      log('SERVER_ERROR'); // Do not log customer data, Graph responses or token-bearing URLs.
      return reply({ok:false,error:'Server error'},500);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(retryMetaEvents(env).catch(() => log('CAPI_RETRY_JOB_ERROR')));
  },
};

async function readBoundedBody(request, maximum) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function sha256(value) {
  const buffer = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer),byte => byte.toString(16).padStart(2,'0')).join('');
}

function metaContact(contact) {
  const value = contact.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return {field:'em',value};
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  let phone = value.replace(/[\s().-]/g,'');
  if (/^00[1-9]/.test(phone)) phone = '+' + phone.slice(2);
  if (/^0[23478]\d{8}$/.test(phone)) phone = '+61' + phone.slice(1);
  if (/^61[23478]\d{8}$/.test(phone)) phone = '+' + phone;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  // Meta requires country-code digits, without '+', before SHA-256.
  return {field:'ph',value:phone.slice(1)};
}

function metaCookie(value) {
  return typeof value === 'string' && value.length <= 256 && /^fb\.[12]\.\d{10,16}\.[a-zA-Z0-9._-]+$/.test(value) ? value : null;
}

async function buildMetaEvent(fields, data, eventId, now, ip, userAgent) {
  let source;
  try { source = new URL(fields.page); } catch { return null; }
  if (!SITE_ORIGINS.has(source.origin)) return null;
  // Drop query strings and fragments, which may contain customer details.
  const userData = {};
  const contact = metaContact(fields.contact);
  if (contact) userData[contact.field] = [await sha256(contact.value)];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  const fbp = metaCookie(data.meta_fbp), fbc = metaCookie(data.meta_fbc);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (!Object.keys(userData).length) return null;
  return {event_name:'Lead',event_time:Math.floor(now/1000),event_id:eventId,action_source:'website',
    event_source_url:source.origin + source.pathname,user_data:userData,custom_data:{lead_type:fields.enquiry_type}};
}

async function retryMetaEvents(env) {
  const now = Date.now();
  // Scrub matching payloads after 24h, including failed or disabled jobs.
  await env.DB.prepare(`UPDATE meta_capi_outbox SET status='expired',payload_json=NULL,test_event_code=NULL,lease_token=NULL
    WHERE payload_json IS NOT NULL AND created_at_ms < ? AND lease_until_ms < ?`).bind(now-MAX_EVENT_AGE_MS,now).run();
  if (env.META_CAPI_ENABLED !== 'true' || !env.META_ACCESS_TOKEN) return;
  const due = await env.DB.prepare(`SELECT event_id FROM meta_capi_outbox
    WHERE status='pending' AND next_attempt_ms<=? AND lease_until_ms<? ORDER BY next_attempt_ms LIMIT 10`).bind(now,now).all();
  // Bound total background duration and outgoing connections.
  for (const row of due.results) await deliverMetaEvent(env,row.event_id);
}

async function deliverMetaEvent(env, eventId) {
  if (env.META_CAPI_ENABLED !== 'true' || !env.META_ACCESS_TOKEN) return;
  const now = Date.now(), lease = crypto.randomUUID();
  const claimed = await env.DB.prepare(`UPDATE meta_capi_outbox SET lease_token=?,lease_until_ms=?,attempts=attempts+1
    WHERE event_id=? AND status='pending' AND next_attempt_ms<=? AND lease_until_ms<? AND created_at_ms>=?`)
    .bind(lease,now+60000,eventId,now,now,now-MAX_EVENT_AGE_MS).run();
  if (claimed.meta.changes !== 1) return;
  const job = await env.DB.prepare('SELECT * FROM meta_capi_outbox WHERE event_id=? AND lease_token=?').bind(eventId,lease).first();
  if (!job) return;
  let delivered = false, permanent = false, errorCode = 'NETWORK_ERROR';
  try {
    const version = /^v\d+\.0$/.test(env.META_GRAPH_API_VERSION || '') ? env.META_GRAPH_API_VERSION : 'v25.0';
    const pixel = /^\d+$/.test(env.META_PIXEL_ID || '') ? env.META_PIXEL_ID : '1328602995881864';
    const body = {data:[JSON.parse(job.payload_json)]};
    if (job.test_event_code) body.test_event_code = job.test_event_code;
    const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.META_ACCESS_TOKEN}`},
      body:JSON.stringify(body),signal:AbortSignal.timeout(5000),
    });
    const json = JSON.parse(await readBoundedBody(response,65536));
    delivered = response.ok && Number(json.events_received) === 1;
    const code = Number(json.error?.code);
    errorCode = `HTTP_${response.status}${Number.isFinite(code) ? `_CODE_${code}` : ''}`;
    // Retry rate limits, server errors and token errors (allow an operator to fix the Secret).
    permanent = !delivered && response.status >= 400 && response.status < 500 && response.status !== 429 && code !== 190 && !json.error?.is_transient;
  } catch { /* Sanitized status only: no payload, token, IP or contact in logs. */ }
  if (delivered) {
    await env.DB.prepare(`UPDATE meta_capi_outbox SET status='sent',sent_at_ms=?,payload_json=NULL,test_event_code=NULL,
      lease_until_ms=0,lease_token=NULL,last_error=NULL WHERE event_id=? AND lease_token=?`).bind(Date.now(),eventId,lease).run();
    log('CAPI_SENT',{event_id:eventId});
  } else {
    const failed = permanent || job.attempts >= MAX_ATTEMPTS;
    const next = Date.now() + Math.min(60*60*1000,60000*2**(job.attempts-1));
    await env.DB.prepare(`UPDATE meta_capi_outbox SET status=?,next_attempt_ms=?,lease_until_ms=0,lease_token=NULL,last_error=?
      WHERE event_id=? AND lease_token=?`).bind(failed?'failed':'pending',next,errorCode,eventId,lease).run();
    log(failed?'CAPI_FAILED':'CAPI_RETRY_PENDING',{event_id:eventId,error:errorCode});
  }
}

function log(event, fields = {}) { console.log(JSON.stringify({event,...fields})); }

async function sendEnquiryEmailViaGraph(env, payload) {
  // 必需环境变量检查
  const tenant = env.MS_TENANT_ID;
  const clientId = env.MS_CLIENT_ID;
  const clientSecret = env.MS_CLIENT_SECRET;
  const to = env.EMAIL_TO;
  const fromUser = env.EMAIL_FROM_USER;

  if (!tenant || !clientId || !clientSecret || !to || !fromUser) {
    console.log("EMAIL_SKIP_missing_env");
    return;
  }

  // 1) 取 token (client credentials)
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    console.log("GRAPH_TOKEN_ERROR", tokenRes.status);
    return;
  }

  const accessToken = tokenJson.access_token;

  // 2) 组装邮件内容
  const subject = `[RUMBLE Enquiry] ${payload.enquiry_type} - ${payload.name}`;
  const html = `
    <h2>New Enquiry</h2>
    <p><b>Time (Sydney):</b> ${payload.submitted_at_sydney}</p>
    <p><b>Name:</b> ${escapeHtml(payload.name)}</p>
    <p><b>Contact:</b> ${escapeHtml(payload.contact)}</p>
    <p><b>Type:</b> ${escapeHtml(payload.enquiry_type)}</p>
    <p><b>Preferred Model:</b> ${escapeHtml(payload.preferred_model || "-")}</p>
    <p><b>Message:</b><br/>${escapeHtml(payload.message).replace(/\n/g, "<br/>")}</p>
    <hr/>
    <p><b>Page:</b> ${escapeHtml(payload.page || "-")}</p>
    <p><b>IP:</b> ${escapeHtml(payload.ip || "-")}</p>
    <p><b>User-Agent:</b> ${escapeHtml(payload.user_agent || "-")}</p>
  `;

  const sendBody = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: to } }],
      // ✅ 建议加 reply-to：让你点回复直接回到客户 contact（如果 contact 是 email 才有意义）
      // replyTo: [{ emailAddress: { address: payload.contact } }]
    },
    saveToSentItems: "true",
  };

  // 3) 调 Graph 发信（从指定用户发出）
  const sendRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromUser)}/sendMail`,
    {
      method: "POST",
    signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    }
  );

  if (!sendRes.ok) {
    console.log("GRAPH_SEND_ERROR", sendRes.status);
    return;
  }

  console.log("GRAPH_SEND_OK");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}