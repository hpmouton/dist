// Local-only development adapter: runs the actual Worker against SQLite.
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from './dist/_worker.js';
export function databaseAdapter(database) {
  const prepare = (sql, values = []) => ({
    bind: (...args) => prepare(sql,args),
    first: async () => database.prepare(sql).get(...values) ?? null,
    all: async () => ({results:database.prepare(sql).all(...values)}),
    run: async () => { const result=database.prepare(sql).run(...values); return {meta:{changes:Number(result.changes)}}; }
  });
  return {prepare, batch: async statements => { database.exec('BEGIN'); try { const results=[]; for(const statement of statements)results.push(await statement.run()); database.exec('COMMIT'); return results; } catch(error){database.exec('ROLLBACK');throw error;} }};
}
export async function startServer({port=4173, memory=false, key='local-preview-only-organiser-access-key'}={}) {
  const root=fileURLToPath(new URL('.',import.meta.url));
  if(!memory)await mkdir(resolve(root,'.local'),{recursive:true});
  const database=new DatabaseSync(memory?':memory:':resolve(root,'.local/rsvp.sqlite'));
  database.exec('PRAGMA foreign_keys=ON');
  database.exec(await readFile(resolve(root,'migrations/0001_rsvp.sql'),'utf8'));
  const dist=resolve(root,'dist');
  const env={DB:databaseAdapter(database),ADMIN_KEY:key,ASSETS:{fetch:async request=>{
    let path=decodeURIComponent(new URL(request.url).pathname); if(path==='/')path='/index.html';
    if(!extname(path))path+='.html'; const file=resolve(dist,'.'+path);
    if(!file.startsWith(dist+sep)||path.startsWith('/_'))return new Response('Not found',{status:404});
    try {return new Response(await readFile(file),{headers:{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
  }}};
  const server=createServer(async(req,res)=>{
    try {
      const host='http://127.0.0.1:'+server.address().port;
      const response=await worker.fetch(new Request(host+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})}),env);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch {res.writeHead(500);res.end('Local preview error');}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {server,database,env,url:'http://127.0.0.1:'+server.address().port,close:async()=>{await new Promise(resolve=>server.close(resolve));database.close();}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=await startServer({key:process.env.ADMIN_KEY||'local-preview-only-organiser-access-key'});
  console.log('Wedding preview: '+app.url+' | Dashboard: '+app.url+'/admin.html');
  console.log('Local data stays in .local/rsvp.sqlite. See RSVP-SETUP.md for the local-only access key.');
}
