const $ = selector => document.querySelector(selector);
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
  async function refresh() {
    const data = await api('admin/list', undefined, true); households = data.invitations; $('#closing-date').value = data.deadline;
    const guests = households.flatMap(i => i.guests);
    for (const value of ['yes','no','pending']) $('#total-' + value).textContent = guests.filter(g => g.attending === value).length;
    render();
  }
  function share(code, target) {
    target.replaceChildren(); target.hidden = false;
    const label = node('label', 'Personal invitation link — copy and send to this household only.');
    const output = node('textarea', undefined, 'share-output'); output.readOnly = true; output.value = new URL('rsvp.html', location.href).href + '#invite=' + code; output.setAttribute('aria-label','Personal invitation link');
    const copy = node('button','Copy link','subtle-button'); copy.type = 'button';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(output.value); copy.textContent = 'Copied'; } catch { output.focus(); output.select(); copy.textContent = 'Select and copy the link above'; } });
    target.append(label,output,copy,node('p','Keep this link. For privacy, it is only shown now. Generating a replacement disables the previous link.','form-help'));
  }
  function render() {
    const list = $('#household-list'), query = $('#guest-search').value.toLowerCase(); list.replaceChildren();
    const filtered = households.filter(i => [i.label,...i.guests.map(g=>g.name)].join(' ').toLowerCase().includes(query));
    if (!filtered.length) list.append(node('p', households.length ? 'No matching guests.' : 'Your guest list is ready to begin. Add your first household.'));
    for (const invite of filtered) {
      const card = node('article',undefined,'household'); card.append(node('h3',invite.label)); const list = node('ul');
      for (const guest of invite.guests) { const li = node('li'), line = node('div',undefined,'guest-line'); line.append(node('strong',guest.name),node('span',({yes:'Attending',no:'Declined',pending:'Awaiting reply'})[guest.attending])); li.append(line); if(guest.dietary)li.append(node('p','Dietary: '+guest.dietary)); list.append(li); }
      card.append(list); if(invite.contact)card.append(node('p','Contact: '+invite.contact)); if(invite.message)card.append(node('p','Message: '+invite.message));
      const reset = node('button','Generate replacement link','subtle-button'); reset.type = 'button';
      const output = node('div',undefined,'share-box'); output.hidden = true;
      reset.addEventListener('click', async () => {
        if (!confirm('Replace the invitation link for ' + invite.label + '? Their old link will stop working. Saved responses will remain.')) return;
        reset.disabled = true; try { const result = await api('admin/reset-code',{id:invite.id},true); share(result.code,output); } catch(error) { status($('#admin-status'),error.message); } finally { reset.disabled = false; }
      }); card.append(reset,output); $('#household-list').append(card);
    }
  }
  login.addEventListener('submit', event => { event.preventDefault(); busy(login, async () => { adminKey = $('#admin-key').value; await refresh(); $('#admin-key').value = ''; $('#login-panel').hidden = true; $('#dashboard').hidden = false; $('#logout').hidden = false; }, $('#login-status')); });
  $('#logout').addEventListener('click', () => { adminKey = ''; households = []; location.reload(); });
  $('#new-household').addEventListener('submit', event => { event.preventDefault(); busy(event.currentTarget, async () => {
    const data = {label:$('#household-label').value, names:$('#guest-names').value.split('\n').map(x=>x.trim()).filter(Boolean)};
    const result = await api('admin/create',data,true); share(result.code,$('#new-link')); $('#new-household').reset();
    status($('#create-status'),'Invitation created for '+data.label+'. Copy the link below.',true);
    try { await refresh(); } catch { status($('#admin-status'),'Invitation saved. Refresh the list to see it.'); }
  }, $('#create-status')); });
  $('#deadline-form').addEventListener('submit', event => { event.preventDefault(); busy(event.currentTarget, async () => { await api('admin/deadline',{deadline:$('#closing-date').value},true); status($('#deadline-status'),'Closing date saved.',true); }, $('#deadline-status')); });
  $('#guest-search').addEventListener('input',render);
  $('#refresh-guests').addEventListener('click', async () => { try { await refresh(); status($('#admin-status'),'Guest list updated.',true); } catch(error){ status($('#admin-status'),error.message); } });
  $('#export-guests').addEventListener('click', async () => {
    try { await refresh(); } catch(error) { status($('#admin-status'),error.message); return; }
    const rows = [['Household','Guest','Response','Dietary requirements','Contact','Message','Last updated'],...households.flatMap(i => i.guests.map(g=>[i.label,g.name,({yes:'Attending',no:'Declined',pending:'Awaiting reply'})[g.attending],g.dietary,i.contact,i.message,i.updated_at||'']))];
    const cell = value => { let text = String(value); if (/^[\s]*[=+@-]/.test(text)) text = "'" + text; return '"'+text.replaceAll('"','""')+'"'; };
    const url = URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})); const a = node('a'); a.href = url; a.download = 'patrick-michelle-rsvps.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
