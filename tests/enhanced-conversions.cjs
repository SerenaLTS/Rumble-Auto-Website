// Offline VM checks: no network requests, no GTM or advertising account access.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto, createHash } = require('node:crypto');
const script = fs.readFileSync(require('node:path').join(__dirname, '../enquiry.js'), 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
let choice = { analytics: true, marketing: true };
const listeners = [];
const snapshots = [];
const events = [];
const w = {
  rumbleConsent: { getChoice: () => choice },
  addEventListener: (type, callback) => listeners.push(callback),
  location: { pathname: '/index.html' },
  dataLayer: { push(event){ events.push(event); snapshots.push({...w.rumbleAdsUserData}); } }
};
const context = vm.createContext({window: w, document: {addEventListener(){}}, crypto: webcrypto, TextEncoder, Uint8Array, setTimeout, clearTimeout, console});
vm.runInContext(script, context);
let idCounter = 0;
function lead(contact, allowed = true){
  context.payload = { contact, event_id: `test-${++idCounter}`, enquiry_type: 'Parts' };
  context.allowed = allowed;
  return vm.runInContext('trackLead(payload, allowed)', context);
}
function empty(){ assert.equal(Object.keys(w.rumbleAdsUserData).length, 0); }
(async () => {
  empty();
  await lead('  First.Last@GMAIL.COM  ');
  assert.deepEqual(snapshots.at(-1), {sha256_email_address:sha256('firstlast@gmail.com')});
  assert(!JSON.stringify(events).includes('First.Last'));
  const firstCallback = events.at(-1).eventCallback;
  firstCallback(); empty();

  for(const phone of ['0412 345 678', '+61 (4)12-345-678', '0061412345678', '61412345678']){
    await lead(phone);
    assert.deepEqual(snapshots.at(-1),{sha256_phone_number:sha256('+61412345678')});
    events.at(-1).eventCallback(); empty();
  }
  await lead('123456'); assert.deepEqual(snapshots.at(-1),{});
  await lead('new@example.com');
  firstCallback(); // A delayed callback from an older lead must not erase this one.
  assert.deepEqual({...w.rumbleAdsUserData},{sha256_email_address:sha256('new@example.com')});
  choice = {analytics: true, marketing: false}; listeners.forEach(fn => fn()); empty();
  choice = {analytics: true, marketing: true}; listeners.forEach(fn => fn()); empty();

  // No retrospective matching when permission was absent at submit time.
  await lead('no-permission@example.com', false);
  assert.deepEqual(snapshots.at(-1),{});
  events.at(-1).eventCallback();

  choice = {analytics: true, marketing: false};
  await lead('analytics-only@example.com'); assert.deepEqual(snapshots.at(-1),{});
  const eventCount = events.length;
  choice = {analytics: false, marketing: false};
  await lead('rejected@example.com'); assert.equal(events.length,eventCount);

  // Withdrawal and regrant during hashing must invalidate the matching data.
  choice = {analytics:true,marketing:true};
  const pending = [];
  context.crypto = {subtle:{digest: () => new Promise(resolve => pending.push(resolve))}};
  const inFlight = lead('pending@example.com');
  choice = {analytics:true,marketing:false};listeners.forEach(fn=>fn());
  choice = {analytics:true,marketing:true};listeners.forEach(fn=>fn());
  pending.shift()(new Uint8Array(32).buffer);
  await inFlight; assert.deepEqual(snapshots.at(-1),{});
  events.at(-1).eventCallback();

  // Digest failure still emits a standard success event with no matching data.
  context.crypto = {subtle:{digest: async () => {throw Error('hash unavailable')}}};
  await lead('hash-failed@example.com');assert.deepEqual(snapshots.at(-1),{});
  events.at(-1).eventCallback(); empty();
  // Hash timeout cannot postpone standard conversion indefinitely.
  context.crypto = {subtle:{digest: () => new Promise(()=>{})}};
  const before = Date.now();
  await lead('hash-timeout@example.com');
  assert(Date.now()-before < 3000);assert.deepEqual(snapshots.at(-1),{});
  events.at(-1).eventCallback(); empty();
  // If GTM never invokes the callback, the data still expires automatically.
  context.crypto = webcrypto;
  await lead('expiry@example.com');
  vm.runInContext('Date.now = () => 9999999999999',context);
  empty();events.at(-1).eventCallback();
  console.log('PASS: email/phone normalization + hashes, event isolation, cleanup, consent withdrawal/race, hash failures/timeout and expiry.');
})().catch(error => { console.error(error);process.exitCode=1; });
