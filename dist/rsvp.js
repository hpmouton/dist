window.initializeWeddingRSVP = () => {
const pageRoot = document.querySelector('main');
const $ = selector => pageRoot.querySelector(selector);
let code = '', adminKey = '', households = [];
const dateLabel = date => new Intl.DateTimeFormat('en-GB', {dateStyle:'long', timeZone:'Africa/Windhoek'}).format(new Date(date + 'T12:00:00+02:00'));
async function api(path, data, authenticated = false) {
  if (location.protocol === 'file:') throw new Error('Please open the hosted wedding website to use RSVP. The local file preview cannot save responses.');
  let response;
  try { response = await fetch('/api/' + path, {method:data === undefined ? 'GET':'POST', cache:'no-store', headers:{'Content-Type':'application/json', ...(authenticated ? {Authorization:'Bearer ' + adminKey}: {})}, ...(data === undefined ? {} : {body:JSON.stringify(data)})}); }
  catch { throw new Error('Could not connect. Please check your connection and try again. Your entries are still here.'); }
  let result; try { result = await response.json(); } catch { throw new Error('RSVP is not connected yet. Please try again later.'); }
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
function status(element, text, success = false) { element.textContent = text; element.classList.toggle('success', success); }
async function busy(form, action, message) {
  const button = form.querySelector('button[type=submit]'); button.disabled = true; status(message, '');
  try { await action(); } catch (error) { status(message, error.message); } finally { button.disabled = false; }
}
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
if ($('#invite-lookup')) {
  const lookup = $('#invite-lookup'), responseForm = $('#response-form');
  function showInvitation(invite) {
    $('#lookup-panel').hidden = true; $('#response-panel').hidden = false;
    $('#household-title').textContent = invite.label;
    $('#deadline-note').textContent = invite.deadline ? 'Please reply by ' + dateLabel(invite.deadline) + '.' : '';
    $('#guest-fields').replaceChildren();
    for (const guest of invite.guests) {
      const fieldset = node('fieldset'); fieldset.dataset.id = guest.id;
      fieldset.append(node('legend', guest.name)); const fields = node('div', undefined, 'guest-fields');
      const label = node('label', 'Will you be joining us?'); const select = node('select');
      select.id = 'attendance-' + guest.id; label.htmlFor = select.id; select.required = true;
      for (const [value, text] of [['','Please choose'],['yes','Joyfully accepts'],['no','Regretfully declines']]) { const option = node('option', text); option.value = value; select.append(option); }
      select.value = guest.attending === 'pending' ? '' : guest.attending; select.disabled = invite.closed;
      const dietaryWrap = node('div'); const dietaryLabel = node('label','Dietary requirements or allergies (optional)');
      const dietary = node('textarea'); dietary.id = 'dietary-' + guest.id; dietaryLabel.htmlFor = dietary.id; dietary.rows = 2; dietary.maxLength = 500; dietary.value = guest.dietary; dietary.disabled = invite.closed;
      dietaryWrap.append(dietaryLabel, dietary); const update = () => { dietaryWrap.hidden = select.value !== 'yes'; }; select.addEventListener('change', update); update();
      fields.append(label, select, dietaryWrap); fieldset.append(fields); $('#guest-fields').append(fieldset);
    }
    $('#guest-contact').value = invite.contact; $('#guest-message').value = invite.message;
    $('#guest-contact').disabled = invite.closed; $('#guest-message').disabled = invite.closed;
    $('#save-response').hidden = invite.closed;
    status($('#response-status'), invite.closed ? 'The RSVP deadline has passed. Please contact Patrick or Michelle about any changes.' : invite.updatedAt ? 'Your previous response is saved. You can update it below.' : '', !!invite.updatedAt && !invite.closed);
    $('#household-title').focus();
  }
  lookup.addEventListener('submit', event => { event.preventDefault(); busy(lookup, async () => { code = $('#invitation-code').value.trim(); showInvitation(await api('invitation', {code})); }, $('#lookup-status')); });
  responseForm.addEventListener('input', () => { $('#confirmation').hidden = true; status($('#response-status'), 'You have unsaved changes. Send your reply to save them.'); });
  responseForm.addEventListener('submit', event => { event.preventDefault(); busy(responseForm, async () => {
    const guests = [...$('#guest-fields').children].map(el => ({id:el.dataset.id, attending:el.querySelector('select').value, dietary:el.querySelector('textarea').value}));
    await api('rsvp', {code, guests, contact:$('#guest-contact').value, message:$('#guest-message').value});
    $('#confirmation').hidden = false; $('#confirmation-copy').textContent = guests.some(g => g.attending === 'yes') ? 'Your response has been saved. We can’t wait to celebrate with you.' : 'Your response has been saved. Thank you for letting us know. You’ll be with us in spirit.';
    $('#confirmation').focus(); status($('#response-status'), 'Response saved successfully.', true);
  }, $('#response-status')); });
  $('#change-invitation').addEventListener('click', () => { code = ''; $('#invitation-code').value = ''; $('#response-panel').hidden = true; $('#confirmation').hidden = true; $('#lookup-panel').hidden = false; $('#invitation-code').focus(); });
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('invite')) { $('#invitation-code').value = fragment.get('invite'); history.replaceState(null, '', location.pathname + location.search); lookup.requestSubmit(); }
  if (location.protocol === 'file:') status($('#lookup-status'), 'This is a local preview. Open the hosted website to find your invitation and save your RSVP.');
}
if ($('#admin-login')) {
  const login = $('#admin-login');
  let page = 1;
  const pageSize = 12;
  const linkFor = value => new URL('rsvp.html', location.href).href + '#invite=' + value;
  const guestStatus = {yes:'Attending',no:'Declined',pending:'Awaiting reply'};
  function view(name) {
    for (const button of pageRoot.querySelectorAll('[data-admin-view]')) button.setAttribute('aria-pressed', String(button.dataset.adminView === name));
    for (const section of pageRoot.querySelectorAll('.admin-view')) section.hidden = section.id !== 'view-' + name;
  }
  pageRoot.querySelectorAll('[data-admin-view]').forEach(button => button.addEventListener('click',()=>view(button.dataset.adminView)));
  async function refresh() {
    const data = await api('admin/list', undefined, true); households = data.invitations; $('#closing-date').value = data.deadline;
    const guests = households.flatMap(i => i.guests);
    $('#total-guests').textContent = guests.length;
    for (const value of ['yes','no','pending']) $('#total-' + value).textContent = guests.filter(g => g.attending === value).length;
    render();
  }
  function copyButton(text, value) {
    const button = node('button',text,'subtle-button'); button.type = 'button';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(value); button.textContent = 'Copied'; setTimeout(()=>{button.textContent=text;},1800); }
      catch { const input = node('textarea',undefined,'share-output'); input.value = value; input.readOnly = true; input.setAttribute('aria-label',text); button.after(input); input.focus(); input.select(); button.textContent = 'Select and copy the text'; }
    }); return button;
  }
  function share(code, target) {
    target.replaceChildren(); target.hidden = false;
    target.append(node('p','Invitation code','field-label'),node('code',code,'invitation-code'));
    const output = node('textarea',undefined,'share-output'); output.readOnly = true; output.value = linkFor(code); output.setAttribute('aria-label','Personal invitation link');
    const actions = node('div',undefined,'admin-actions'); actions.append(copyButton('Copy code',code),copyButton('Copy link',linkFor(code)));
    target.append(output,actions,node('p','This code is also available in the guest list whenever you sign in. Share the link only with this household.','form-help'));
  }
  function render() {
    const list = $('#household-list'), query = $('#guest-search').value.trim().toLowerCase(), filter = $('#guest-filter').value;
    const expanded = new Set([...list.querySelectorAll('details[open]')].map(el=>el.dataset.id));
    list.replaceChildren();
    const filtered = households.filter(i => [i.label,i.code||'',...i.guests.map(g=>g.name)].join(' ').toLowerCase().includes(query))
      .filter(i => filter === 'all' || (filter === 'dietary' ? i.guests.some(g=>g.dietary.trim()) : filter === 'missing-code' ? !i.code : i.guests.some(g=>g.attending===filter)));
    const sort = $('#guest-sort').value;
    filtered.sort((a,b) => (sort==='recent' ? (b.updated_at||'').localeCompare(a.updated_at||'') : sort==='pending' ? b.guests.filter(g=>g.attending==='pending').length-a.guests.filter(g=>g.attending==='pending').length : 0) || a.label.localeCompare(b.label));
    const pages = Math.max(1,Math.ceil(filtered.length/pageSize)); page=Math.min(page,pages);
    const start=(page-1)*pageSize;
    $('#guest-results').textContent = filtered.length ? `${start+1}–${Math.min(start+pageSize,filtered.length)} of ${filtered.length} invitations · ${households.length} total` : 'No matching invitations';
    $('#page-label').textContent = `Page ${page} of ${pages}`;
    $('#previous-page').disabled=page===1; $('#next-page').disabled=page===pages;
    if (!filtered.length) list.append(node('p', households.length ? 'Try a different name or clear your filter.' : 'Your guest list is ready to begin. Select “Add invitation” to add your first household.','admin-empty'));
    for (const invite of filtered.slice(start,start+pageSize)) {
      const card=node('article',undefined,'invitation-row');
      const heading=node('div',undefined,'invitation-row-heading');
      const title=node('div'); title.append(node('h3',invite.label),node('p',`${invite.guests.length} invited ${invite.guests.length===1?'guest':'guests'}`,'invitation-count'));
      const badges=node('div',undefined,'invitation-badges');
      for(const state of ['yes','no','pending']){const count=invite.guests.filter(g=>g.attending===state).length;if(count)badges.append(node('span',`${count} ${guestStatus[state].toLowerCase()}`,'status-badge status-'+state));}
      heading.append(title,badges);card.append(heading);
      const codeRow=node('div',undefined,'invitation-code-row');
      if(invite.code){codeRow.append(node('code',invite.code,'invitation-code'),copyButton('Copy code',invite.code),copyButton('Copy link',linkFor(invite.code)));}
      else codeRow.append(node('span','Older invitation · restore its code below','legacy-code'));
      card.append(codeRow);
      const details=node('details',undefined,'invitation-details');details.dataset.id=invite.id;details.open=expanded.has(invite.id);
      details.append(node('summary','Guest replies & invitation details'));
      const guests=node('ul',undefined,'invitation-guests');
      for(const guest of invite.guests){const li=node('li');const line=node('div',undefined,'guest-line');line.append(node('strong',guest.name),node('span',guestStatus[guest.attending],'status-badge status-'+guest.attending));li.append(line);if(guest.dietary)li.append(node('p','Dietary: '+guest.dietary));guests.append(li);}
      details.append(guests);
      if(invite.contact)details.append(node('p','Contact: '+invite.contact,'invitation-note'));
      if(invite.message)details.append(node('p','Message: '+invite.message,'invitation-note'));
      if(invite.updated_at)details.append(node('p','Last reply: '+new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Windhoek'}).format(new Date(invite.updated_at)),'form-help'));
      const feedback=node('p',undefined,'form-status');feedback.setAttribute('role','status');
      if(!invite.code){
        const restore=node('form',undefined,'restore-code-form');const label=node('label','Have the original link or code?');const input=node('input');input.id='restore-'+invite.id;input.required=true;input.maxLength=2048;label.htmlFor=input.id;input.placeholder='Paste the original invitation link or code';const save=node('button','Restore code','subtle-button');save.type='submit';restore.append(label,input,save,node('p','Restoring keeps the existing link valid. Older codes cannot be recovered from their saved hashes.','form-help'));
        restore.addEventListener('submit',event=>{event.preventDefault();busy(restore,async()=>{let value=input.value.trim();try{const url=new URL(value);value=new URLSearchParams(url.hash.slice(1)).get('invite')||value;}catch{}const result=await api('admin/restore-code',{id:invite.id,code:value},true);invite.code=result.code;render();status($('#admin-status'),'Invitation code restored. The existing link still works.',true);},feedback);});details.append(restore);
      }
      const reset=node('button','Replace invitation code','subtle-button');reset.type='button';
      reset.addEventListener('click',async()=>{if(!confirm('Replace the invitation code for '+invite.label+'? The old link will stop working. Saved replies will remain.'))return;reset.disabled=true;try{const result=await api('admin/reset-code',{id:invite.id},true);invite.code=result.code;render();status($('#admin-status'),'New code saved for '+invite.label+'. Copy the new link from their row.',true);}catch(error){status(feedback,error.message);}finally{reset.disabled=false;}});
      const replacement=node('div',undefined,'replacement-action');replacement.append(reset,node('p','Only replace a code when you need to disable the old invitation link.','form-help'));
      details.append(replacement,feedback);card.append(details);list.append(card);
    }
  }
  login.addEventListener('submit', event => { event.preventDefault(); busy(login, async () => { adminKey=$('#admin-key').value;await refresh();$('#admin-key').value='';$('#login-panel').hidden=true;$('#dashboard').hidden=false;$('#logout').hidden=false; },$('#login-status')); });
  $('#logout').addEventListener('click',()=>{adminKey='';households=[];location.reload();});
  $('#new-household').addEventListener('submit',event=>{event.preventDefault();busy(event.currentTarget,async()=>{const data={label:$('#household-label').value,names:$('#guest-names').value.split('\n').map(x=>x.trim()).filter(Boolean)};const result=await api('admin/create',data,true);share(result.code,$('#new-link'));$('#new-household').reset();status($('#create-status'),'Invitation created for '+data.label+'.',true);try{await refresh();}catch{status($('#create-status'),'Invitation saved. Refresh the guest list to see it.',true);}},$('#create-status'));});
  $('#deadline-form').addEventListener('submit',event=>{event.preventDefault();busy(event.currentTarget,async()=>{await api('admin/deadline',{deadline:$('#closing-date').value},true);status($('#deadline-status'),'Closing date saved.',true);},$('#deadline-status'));});
  for(const id of ['guest-search','guest-filter','guest-sort'])$('#'+id).addEventListener(id==='guest-search'?'input':'change',()=>{page=1;render();});
  $('#previous-page').addEventListener('click',()=>{page--;render();$('#guest-results').scrollIntoView({block:'nearest'});});
  $('#next-page').addEventListener('click',()=>{page++;render();$('#guest-results').scrollIntoView({block:'nearest'});});
  $('#refresh-guests').addEventListener('click',async()=>{try{await refresh();status($('#admin-status'),'Guest list updated.',true);}catch(error){status($('#admin-status'),error.message);}});
  $('#export-guests').addEventListener('click',async()=>{
    try{await refresh();}catch(error){status($('#admin-status'),error.message);return;}
    const rows=[['Household','Guest','Response','Dietary requirements','Contact','Message','Last updated'],...households.flatMap(i=>i.guests.map(g=>[i.label,g.name,guestStatus[g.attending],g.dietary,i.contact,i.message,i.updated_at||'']))];
    const cell=value=>{let text=String(value);if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=node('a');a.href=url;a.download='patrick-michelle-rsvps.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}

};
window.initializeWeddingRSVP();
