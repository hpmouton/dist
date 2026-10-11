import assert from 'node:assert/strict';
import {startServer} from '../dev-server.mjs';
const app=await startServer({port:0,memory:true});
const key='local-preview-only-organiser-access-key';
async function api(path,data,auth=true,origin=app.url){
 const response=await fetch(app.url+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(auth?{Authorization:'Bearer '+key}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:response.status,body:await response.json()};
}
try{
 const a=(await api('admin/create',{label:'Family A',names:['One','Two']})).body;
 const b=(await api('admin/create',{label:'Family B',names:['Other']})).body;
 const original=(await api('invitation',{code:a.code},false)).body;
 const other=(await api('invitation',{code:b.code},false)).body;
 const payload={id:a.id,label:'Updated family',contact:'new@example.test',message:'Updated notes',guests:original.guests.map(g=>({...g,attending:'yes',dietary:'Vegetarian'}))};
 for(const route of ['admin/update','admin/delete']){
   assert.equal((await api(route,payload,false)).status,401);
   assert.equal((await api(route,payload,true,'https://other.example')).status,403);
   assert.equal((await api(route,{...payload,id:'missing'})).status,404);
 }
 for(const guests of [[],Array(31).fill(payload.guests[0]),[payload.guests[0],payload.guests[0]],[{...payload.guests[0],id:other.guests[0].id}],[{...payload.guests[0],attending:'invalid'}],[null],[{...payload.guests[0],name:''}]]){
   assert.equal((await api('admin/update',{...payload,guests})).status,400);
 }
 assert.equal((await api('admin/update',{...payload,contact:'x'.repeat(201)})).status,400);
 assert.equal((await api('invitation',{code:a.code},false)).body.label,'Family A');
 await api('admin/deadline',{deadline:'2020-01-01'});
 assert.equal((await api('admin/update',payload)).status,200,'organiser can edit after deadline');
 let saved=(await api('invitation',{code:a.code},false)).body;
 assert.equal(saved.label,payload.label);assert.equal(saved.contact,payload.contact);assert.equal(saved.message,payload.message);
 assert.equal(saved.guests[0].id,original.guests[0].id);assert.equal(saved.guests[0].dietary,'Vegetarian');assert.ok(saved.updatedAt);
 assert.equal((await api('admin/list')).body.invitations.find(i=>i.id===a.id).code,a.code,'link and code unchanged');
 const roster={...payload,guests:[{...saved.guests[0],name:'Corrected name',attending:'pending'},{id:null,name:'New guest',attending:'no',dietary:'Ignored'}]};
 assert.equal((await api('admin/update',roster)).status,200);
 saved=(await api('invitation',{code:a.code},false)).body;
 assert.equal(saved.guests.length,2);assert.equal(saved.guests[0].name,'Corrected name');assert.equal(saved.guests[0].dietary,'');
 assert.equal(saved.guests[1].name,'New guest');assert.equal(saved.guests[1].attending,'no');assert.equal(saved.guests[1].dietary,'');
 assert.equal(app.database.prepare('SELECT id FROM guests WHERE id=?').get(original.guests[1].id),undefined);
 assert.equal((await api('invitation',{code:b.code},false)).body.guests[0].name,'Other');
 // A failed batch must roll back both deletion and insertion when saving an edit.
 app.database.exec("CREATE TRIGGER reject_admin_test BEFORE UPDATE ON invitations WHEN NEW.label='Reject me' BEGIN SELECT RAISE(ABORT, 'test rollback'); END;");
 assert.equal((await api('admin/update',{...roster,label:'Reject me',guests:[{id:null,name:'Not saved',attending:'pending'}]})).status,503);
 assert.deepEqual((await api('invitation',{code:a.code},false)).body.guests,saved.guests);
 assert.equal((await api('admin/delete',{id:a.id})).status,200);
 assert.equal((await api('invitation',{code:a.code},false)).status,404);
 assert.equal(app.database.prepare('SELECT COUNT(*) AS n FROM guests WHERE invitation_id=?').get(a.id).n,0);
 assert.equal(app.database.prepare('SELECT value FROM settings WHERE key=?').get('invitation_code:'+a.id),undefined);
 assert.equal((await api('admin/list')).body.invitations.length,1);
 assert.equal((await api('invitation',{code:b.code},false)).status,200);
 assert.equal((await api('admin/delete',{id:a.id})).status,404);
 console.log('PASS: authenticated edit/delete, validation, stable links and guest IDs, roster changes, deadline override, isolation, transactional rollback and deletion cleanup.');
}finally{await app.close();}
