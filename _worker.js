// Cloudflare Pages advanced-mode Worker. No guest data or secrets belong in public files.
const encoder = new TextEncoder();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY'
}});
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), x => x.toString(16).padStart(2, '0')).join('');
}
function randomCode() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join(''); }
function field(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('Please check the form fields.');
  return value.trim();
}
async function body(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) fail('Please send JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) fail('Missing form data.');
  const chunks = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.length; if (size > 32768) { await reader.cancel(); fail('This response is too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let result; try { result = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('Invalid form data.'); }
  if (!result || Array.isArray(result) || typeof result !== 'object') fail('Invalid form data.');
  return result;
}
async function admin(request, env) {
  if (!env.ADMIN_KEY || env.ADMIN_KEY.length < 32) fail('The organiser dashboard has not been configured yet.', 503);
  const provided = request.headers.get('authorization') || '';
  const a = await hash(provided), b = await hash('Bearer ' + env.ADMIN_KEY);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff) fail('Please enter the correct organiser access key.', 401);
}
async function deadline(db) { return (await db.prepare("SELECT value FROM settings WHERE key = 'deadline'").first())?.value || ''; }
function isClosed(date) { return !!date && Date.now() > Date.parse(date + 'T23:59:59+02:00'); }
async function invitation(db, code) {
  if (typeof code !== 'string' || !/^[a-f0-9]{32}$/i.test(code.trim())) fail('We could not find that invitation. Please check your code.', 404);
  const row = await db.prepare('SELECT * FROM invitations WHERE code_hash = ?').bind(await hash(code.trim().toLowerCase())).first();
  if (!row) fail('We could not find that invitation. Please check your code.', 404);
  return row;
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (!env.DB) fail('RSVP is not available just yet. Please try again later.', 503);
      if (!['GET','POST'].includes(request.method)) fail('Method not allowed.', 405);
      if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) fail('Please submit from the wedding website.', 403);
      const db = env.DB;
      if (path.startsWith('/api/admin/')) await admin(request, env);
      if (path === '/api/settings' && request.method === 'GET') return json({deadline: await deadline(db)});
      if (path === '/api/invitation' && request.method === 'POST') {
        const data = await body(request), row = await invitation(db, data.code), date = await deadline(db);
        const {results} = await db.prepare('SELECT id, name, attending, dietary FROM guests WHERE invitation_id = ? ORDER BY rowid').bind(row.id).all();
        return json({label: row.label, guests: results, contact: row.contact, message: row.message, updatedAt: row.updated_at, deadline: date, closed: isClosed(date)});
      }
      if (path === '/api/rsvp' && request.method === 'POST') {
        const data = await body(request), row = await invitation(db, data.code);
        if (isClosed(await deadline(db))) fail('The RSVP deadline has passed. Please contact Patrick or Michelle about changes.', 403);
        const {results: guests} = await db.prepare('SELECT id FROM guests WHERE invitation_id = ?').bind(row.id).all();
        if (!Array.isArray(data.guests) || data.guests.length !== guests.length || new Set(data.guests.map(g => g?.id)).size !== guests.length) fail('Please reply for everyone on your invitation.');
        const statements = data.guests.map(g => {
          if (!g || !guests.some(x => x.id === g.id) || !['yes','no'].includes(g.attending)) fail('Please choose an answer for each invited guest.');
          const dietary = field(g.dietary ?? '', 500);
          return db.prepare('UPDATE guests SET attending = ?, dietary = ? WHERE id = ? AND invitation_id = ?').bind(g.attending, g.attending === 'yes' ? dietary : '', g.id, row.id);
        });
        const updatedAt = new Date().toISOString();
        statements.push(db.prepare('UPDATE invitations SET contact = ?, message = ?, updated_at = ? WHERE id = ?').bind(field(data.contact ?? '', 200), field(data.message ?? '', 1000), updatedAt, row.id));
        await db.batch(statements);
        return json({ok: true, updatedAt});
      }
      if (path === '/api/admin/list' && request.method === 'GET') {
        const {results: invitations} = await db.prepare('SELECT id, label, contact, message, updated_at FROM invitations ORDER BY label').all();
        const {results: guests} = await db.prepare('SELECT id, invitation_id, name, attending, dietary FROM guests ORDER BY rowid').all();
        return json({invitations: invitations.map(i => ({...i, guests: guests.filter(g => g.invitation_id === i.id)})), deadline: await deadline(db)});
      }
      if (path === '/api/admin/create' && request.method === 'POST') {
        const data = await body(request), label = field(data.label, 150, true);
        if (!Array.isArray(data.names) || !data.names.length || data.names.length > 30) fail('Add between 1 and 30 invited guests.');
        const names = data.names.map(n => field(n, 150, true)), id = crypto.randomUUID(), code = randomCode();
        await db.batch([
          db.prepare('INSERT INTO invitations (id,label,code_hash) VALUES (?,?,?)').bind(id, label, await hash(code)),
          ...names.map(name => db.prepare('INSERT INTO guests (id,invitation_id,name) VALUES (?,?,?)').bind(crypto.randomUUID(), id, name))
        ]);
        return json({id, code}, 201);
      }
      if (path === '/api/admin/reset-code' && request.method === 'POST') {
        const data = await body(request), id = field(data.id, 50, true), code = randomCode();
        const result = await db.prepare('UPDATE invitations SET code_hash = ? WHERE id = ?').bind(await hash(code), id).run();
        if (!result.meta.changes) fail('Invitation not found.', 404);
        return json({code});
      }
      if (path === '/api/admin/deadline' && request.method === 'POST') {
        const data = await body(request), value = field(data.deadline, 10);
        if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) fail('Please choose a valid closing date.');
        await db.prepare("INSERT INTO settings (key,value) VALUES ('deadline',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(value).run();
        return json({ok: true});
      }
      fail('Not found.', 404);
    } catch (error) {
      if (!error.status) console.error('RSVP storage request failed:', error.message);
      return json({error: error.status ? error.message : 'We could not save or load your response. Please try again shortly. Your form has not been cleared.'}, error.status || 503);
    }
  }
};
