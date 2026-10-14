import assert from 'node:assert/strict';
import {startServer} from '../dev-server.mjs';
const app = await startServer({port:0, memory:true});
async function api(path, data, admin=false) {
  const response = await fetch(app.url+'/api/'+path, {method:'POST', headers:{'Content-Type':'application/json', Origin:app.url, ...(admin ? {Authorization:'Bearer local-preview-only-organiser-access-key'} : {})}, body:JSON.stringify(data)});
  return {status:response.status, body:await response.json()};
}
try {
  const {body:{code}} = await api('admin/create', {label:'Shared invitation', names:['Alex','Sam','Taylor']}, true);
  const {body:initial} = await api('invitation', {code});
  const [alex,sam,taylor] = initial.guests;
  const read = async () => (await api('invitation', {code})).body;
  const reply = (guest, attending='yes', dietary='') => ({id:guest.id, attending, dietary});
  assert.equal((await api('rsvp', {code,guests:[],contact:'household@example.test',message:'Original note'})).status,200);
  // Two people submit independently from the same original invitation snapshot.
  const saved = await Promise.all([
    api('rsvp', {code,guests:[reply(alex,'yes','Vegetarian')]}),
    api('rsvp', {code,guests:[reply(sam,'no')]})
  ]);
  assert.deepEqual(saved.map(r=>r.status),[200,200]);
  let invite = await read();
  assert.deepEqual(invite.guests.map(g=>g.attending),['yes','no','pending']);
  assert.equal(invite.guests[0].dietary,'Vegetarian');
  assert.equal(invite.contact,'household@example.test');assert.equal(invite.message,'Original note');
  assert.ok(invite.updatedAt);
  await Promise.all([api('rsvp',{code,guests:[],contact:'updated@example.test'}),api('rsvp',{code,guests:[],message:'New note'})]);
  invite = await read();assert.equal(invite.contact,'updated@example.test');assert.equal(invite.message,'New note');
  const before = JSON.stringify(invite);
  const other = (await api('admin/create',{label:'Other',names:['Other guest']},true)).body;
  const outsider = (await api('invitation',{code:other.code})).body.guests[0];
  for (const payload of [
    {guests:[]}, {guests:[reply(outsider)]}, {guests:[reply(taylor),reply(taylor)]},
    {guests:[reply(alex,'pending')]}, {guests:[reply(taylor)],message:null},
    {guests:[reply(taylor)],contact:'x'.repeat(201)}, {guests:[null]},
    {guests:[reply(taylor),reply(sam,'yes','x'.repeat(501))]}
  ]) assert.equal((await api('rsvp',{code,...payload})).status,400);
  assert.equal(JSON.stringify(await read()),before,'Rejected submissions change no guest or shared field');
  assert.equal((await api('rsvp',{code,guests:[reply(alex,'no','Old dietary note')]})).status,200);
  invite=await read();assert.equal(invite.guests[0].dietary,'');assert.equal(invite.guests[1].attending,'no');assert.equal(invite.guests[2].attending,'pending');
  await api('rsvp',{code,guests:[],message:''});assert.equal((await read()).message,'');
  await api('admin/deadline',{deadline:'2020-01-01'},true);
  assert.equal((await api('rsvp',{code,guests:[reply(taylor)]})).status,403);
  assert.equal((await api('rsvp',{code,guests:[],message:'Late note'})).status,403);
  console.log('PASS: independent/concurrent replies, untouched guests and notes, partial notes, validation, ownership and deadlines.');
} finally { await app.close(); }
