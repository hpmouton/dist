import assert from 'node:assert/strict';
import {startServer} from '../dev-server.mjs';
import worker from '../dist/_worker.js';
const app=await startServer({port:0,memory:true});
const key='local-preview-only-organiser-access-key';
async function api(path,data,auth=false,origin=app.url){
 const response=await fetch(app.url+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(auth?{Authorization:'Bearer '+key}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:response.status,body:await response.json(),headers:response.headers};
}
try {
 assert.equal((await api('admin/list')).status,401);
 assert.equal((await api('admin/create',{label:'Test',names:['A']},true,'https://elsewhere.example')).status,403);
 assert.equal((await api('admin/create',{label:'Empty',names:[]},true)).status,400);
 const a=await api('admin/create',{label:'Family A',names:['Guest One','Guest Two']},true);
 const b=await api('admin/create',{label:'Family B',names:['Guest Three']},true);
 assert.equal(a.status,201);assert.equal(b.status,201);
 assert.equal((await api('invitation',{code:'wrong'})).status,404);
 const invite=(await api('invitation',{code:a.body.code})).body;
 assert.equal(invite.guests.length,2);assert.equal(invite.guests[0].attending,'pending');
 const other=(await api('invitation',{code:b.body.code})).body;
 const guests=invite.guests.map((g,i)=>({id:g.id,attending:i?'no':'yes',dietary:'Vegetarian'}));
 const payload={code:a.body.code,guests,contact:'test@example.test',message:'Looking forward to it'};
 assert.equal((await api('rsvp',{...payload,guests:[guests[0]]})).status,400);
 assert.equal((await api('rsvp',{...payload,guests:[guests[0],guests[0]]})).status,400);
 assert.equal((await api('rsvp',{...payload,guests:[guests[0],{...guests[1],id:other.guests[0].id}]})).status,400);
 assert.equal((await api('rsvp',{...payload,contact:'x'.repeat(201)})).status,400);
 assert.equal((await api('invitation',{code:a.body.code})).body.guests[0].attending,'pending');
 assert.equal((await api('rsvp',payload)).status,200);
 let saved=(await api('invitation',{code:a.body.code})).body;
 assert.equal(saved.contact,payload.contact);assert.equal(saved.guests[0].dietary,'Vegetarian');assert.equal(saved.guests[1].dietary,'');assert.ok(saved.updatedAt);
 assert.equal((await api('rsvp',payload)).status,200); // retry updates, never inserts duplicates
 assert.equal((await api('admin/list',undefined,true)).body.invitations.length,2);
 assert.equal((await api('invitation',{code:b.body.code})).body.guests[0].attending,'pending');
 assert.equal((await api('admin/deadline',{deadline:'2026-02-30'},true)).status,400);
 await api('admin/deadline',{deadline:'2020-01-01'},true);
 assert.equal((await api('invitation',{code:a.body.code})).body.closed,true);
 assert.equal((await api('rsvp',payload)).status,403);
 await api('admin/deadline',{deadline:''},true);
 const reset=await api('admin/reset-code',{id:a.body.id},true);
 assert.equal((await api('invitation',{code:a.body.code})).status,404);
 assert.equal((await api('invitation',{code:reset.body.code})).body.contact,payload.contact);
 const row=app.database.prepare('SELECT code_hash FROM invitations WHERE id=?').get(a.body.id);
 assert.notEqual(row.code_hash,reset.body.code);assert.equal(row.code_hash.length,64);
 assert.equal((await api('settings')).headers.get('cache-control'),'no-store');
 const unavailable=await worker.fetch(new Request(app.url+'/api/settings'),{});assert.equal(unavailable.status,503);
 // D1 batch behavior: any failed write must roll back preceding writes.
 await assert.rejects(app.env.DB.batch([app.env.DB.prepare("UPDATE guests SET name='Changed' WHERE id=?").bind(guests[0].id),app.env.DB.prepare("INSERT INTO guests (id,invitation_id,name) VALUES ('bad','absent','Bad')")]));
 assert.equal(app.database.prepare('SELECT name FROM guests WHERE id=?').get(guests[0].id).name,'Guest One');
 console.log('PASS: authorisation, origin checks, invitations, isolation, validation, persistence, retries, deadline, link revocation, hashed codes and transactional rollback.');
}finally{await app.close();}
