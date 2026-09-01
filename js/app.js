import { supabase, YORKU_EMAIL_RE } from './supabaseClient.js';

const el = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  document.body.dataset.screen = id;
  el('frame').scrollTop = 0;
}

const CAMPUS_OPTIONS = ['All', 'Keele', 'Glendon', 'Online'];
const TYPE_OPTIONS = ['All', 'Dropping', 'Needed'];

let me = null;               // { id, email, name }
let listingsCache = [];
let filters = { type: 'All', term: 'All', subject: 'All', campus: 'All', search: '' };
let currentConversation = null;
let messageChannel = null;
let postType = 'dropping';

/* ============================== boot ============================== */

async function boot() {
  applySelectChevrons();
  wireAuth();
  wireBoard();
  wirePost();
  wireDM();

  // The board is public — show it immediately, don't wait on auth to load it.
  showScreen('screen-board');
  await refreshListings();

  const { data: { session } } = await supabase.auth.getSession();
  await onSessionChange(session);

  supabase.auth.onAuthStateChange((_event, newSession) => {
    onSessionChange(newSession);
  });
}

async function onSessionChange(session) {
  if (session && session.user) {
    me = await ensureProfile(session.user);
  } else {
    me = null;
    if (messageChannel) { supabase.removeChannel(messageChannel); messageChannel = null; }
    currentConversation = null;
    // signed out mid-flow on a screen that requires an account — send them back to the board
    if (document.body.dataset.screen === 'screen-post' || document.body.dataset.screen === 'screen-dm') {
      showScreen('screen-board');
    }
  }
  resetAuthForm();
  updateAuthUI();
  await refreshListings();
}

function updateAuthUI() {
  const btn = el('auth-action');
  if (me) {
    btn.classList.add('icon');
    btn.setAttribute('aria-label', 'Account');
    btn.title = 'Account';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
  } else {
    btn.classList.remove('icon');
    btn.removeAttribute('title');
    btn.removeAttribute('aria-label');
    btn.textContent = 'Sign in';
  }
  renderAuthScreen();
}

function renderAuthScreen() {
  const signedOut = el('auth-signed-out');
  const account = el('auth-account');
  if (me) {
    signedOut.style.display = 'none';
    account.style.display = 'flex';
    el('account-avatar').textContent = (me.name.trim().charAt(0) || 'Y').toUpperCase();
    el('account-name-display').textContent = me.name;
    el('account-email').textContent = me.email;
    el('account-name-input').value = me.name;
    el('account-name-error').textContent = '';
  } else {
    signedOut.style.display = 'flex';
    account.style.display = 'none';
  }
}

async function ensureProfile(user) {
  const { data, error } = await supabase.from('profiles').select('id, display_name').eq('id', user.id).maybeSingle();
  if (!error && data) return { id: user.id, email: user.email, name: data.display_name };
  return { id: user.id, email: user.email, name: (user.email || 'You').split('@')[0] };
}

function applySelectChevrons() {
  const chevron = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2360606a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E";
  document.querySelectorAll('select.field-input').forEach((s) => { s.style.backgroundImage = `url("${chevron}")`; });
}

/* ============================== auth ============================== */

function wireAuth() {
  el('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = el('auth-email').value.trim();
    const errorEl = el('auth-error');
    errorEl.textContent = '';

    if (!YORKU_EMAIL_RE.test(email)) {
      errorEl.textContent = 'Please use your YorkU email (@my.yorku.ca or @yorku.ca).';
      return;
    }

    const btn = el('auth-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    btn.disabled = false;
    btn.textContent = 'Send magic link';

    if (error) { errorEl.textContent = error.message; return; }

    el('auth-form').style.display = 'none';
    el('auth-sent').style.display = 'block';
    el('auth-sent-email').textContent = email;
  });

  el('auth-again').addEventListener('click', resetAuthForm);
  el('back-from-auth').addEventListener('click', () => showScreen('screen-board'));

  el('account-name-save').addEventListener('click', saveDisplayName);
  el('account-sign-out').addEventListener('click', () => supabase.auth.signOut());
  el('account-delete').addEventListener('click', deleteMyAccount);
}

async function saveDisplayName() {
  if (!me) return;
  const input = el('account-name-input');
  const errorEl = el('account-name-error');
  const name = input.value.trim();
  errorEl.textContent = '';

  if (!name) { errorEl.textContent = "Display name can't be empty."; return; }
  if (name.length > 40) { errorEl.textContent = 'Keep it under 40 characters.'; return; }

  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', me.id);
  if (error) { errorEl.textContent = error.message; return; }

  me.name = name;
  el('account-name-display').textContent = name;
  el('account-avatar').textContent = (name.charAt(0) || 'Y').toUpperCase();
  await refreshListings();
}

async function deleteMyAccount() {
  if (!me) return;
  const sure = confirm("Delete your display name, listings, and messages? This can't be undone.");
  if (!sure) return;

  const { error } = await supabase.from('profiles').delete().eq('id', me.id);
  if (error) { el('account-name-error').textContent = error.message; return; }

  await supabase.auth.signOut();
  showScreen('screen-board');
}

function resetAuthForm() {
  el('auth-form').style.display = 'flex';
  el('auth-sent').style.display = 'none';
  el('auth-form').reset();
  el('auth-error').textContent = '';
}

/* ============================== board ============================== */

function wireBoard() {
  el('auth-action').addEventListener('click', () => showScreen('screen-auth'));
  el('fab-post').addEventListener('click', () => {
    if (!me) { showScreen('screen-auth'); return; }
    resetPostForm();
    showScreen('screen-post');
  });
  el('search-course').addEventListener('input', (e) => { filters.search = e.target.value; renderBoard(); });

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) { filters[chip.dataset.key] = chip.dataset.val; renderChips(); renderBoard(); return; }
    const card = e.target.closest('.card');
    if (!card) return;
    if (card.classList.contains('mine')) {
      removeListing(card.dataset.listingId);
    } else if (!me) {
      showScreen('screen-auth');
    } else {
      openDM(card.dataset);
    }
  });
}

async function removeListing(id) {
  const sure = confirm("Remove this listing? This can't be undone.");
  if (!sure) return;

  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) { console.error(error); alert("Couldn't remove that listing: " + error.message); return; }

  await refreshListings();
}

async function refreshListings() {
  el('board-scroll').innerHTML = '<div class="loading-note">Loading listings…</div>';
  const { data, error } = await supabase
    .from('listings')
    .select('id, type, subject, course_number, section, term, campus, note, user_id, profiles(display_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    el('board-scroll').innerHTML = '<div class="no-results">Couldn’t load listings — try reloading.</div>';
    listingsCache = [];
    return;
  }
  listingsCache = data || [];
  renderChips();
  renderBoard();
}

function uniqueSorted(arr) { return Array.from(new Set(arr)).sort(); }

function renderChips() {
  mountChips('chip-type', 'type', TYPE_OPTIONS);
  mountChips('chip-term', 'term', ['All', ...uniqueSorted(listingsCache.map((r) => r.term))]);
  mountChips('chip-subject', 'subject', ['All', ...uniqueSorted(listingsCache.map((r) => r.subject))]);
  mountChips('chip-campus', 'campus', CAMPUS_OPTIONS);
}

function mountChips(mountId, key, options) {
  if (!options.includes(filters[key])) filters[key] = 'All';
  el(mountId).innerHTML = options.map((opt) => {
    const pressed = filters[key] === opt;
    return `<button class="chip" type="button" data-key="${key}" data-val="${esc(opt)}" aria-pressed="${pressed}">${esc(opt)}</button>`;
  }).join('');
}

function renderBoard() {
  const q = filters.search.trim().toLowerCase().replace(/\s+/g, '');
  const rows = listingsCache.filter((r) => {
    if (filters.term !== 'All' && r.term !== filters.term) return false;
    if (filters.subject !== 'All' && r.subject !== filters.subject) return false;
    if (filters.campus !== 'All' && r.campus !== filters.campus) return false;
    if (q && !(r.subject + r.course_number).toLowerCase().replace(/\s+/g, '').includes(q)) return false;
    return true;
  });

  const groups = new Map();
  rows.forEach((r) => {
    const key = r.subject + '|' + r.course_number + '|' + r.term;
    if (!groups.has(key)) groups.set(key, { course: r.subject + ' ' + r.course_number, term: r.term, dropping: [], needed: [] });
    groups.get(key)[r.type === 'dropping' ? 'dropping' : 'needed'].push(r);
  });
  const threads = Array.from(groups.values())
    .filter((t) => {
      if (filters.type === 'Dropping') return t.dropping.length > 0;
      if (filters.type === 'Needed') return t.needed.length > 0;
      return true;
    })
    .sort((a, b) => a.course.localeCompare(b.course));

  if (threads.length === 0) {
    el('board-scroll').innerHTML = listingsCache.length === 0
      ? '<div class="no-results">No listings yet — be the first to post one.</div>'
      : '<div class="no-results">No listings match your filters.</div>';
    return;
  }

  el('board-scroll').innerHTML = threads.map((t) => {
    const cols = filters.type === 'Dropping'
      ? `<div class="thread-cols one-col">${columnHtml(t.dropping, 'drop', 'Dropping', 'No one dropping yet')}</div>`
      : filters.type === 'Needed'
        ? `<div class="thread-cols one-col">${columnHtml(t.needed, 'need', 'Needed', 'Nobody needs this yet')}</div>`
        : `<div class="thread-cols">${columnHtml(t.dropping, 'drop', 'Dropping', 'No one dropping yet')}${columnHtml(t.needed, 'need', 'Needed', 'Nobody needs this yet')}</div>`;
    return `
      <div>
        <div class="thread-head"><div class="course">${esc(t.course)}</div><div class="term">${esc(t.term)}</div></div>
        ${cols}
      </div>
    `;
  }).join('');
}

function columnHtml(items, dotClass, label, emptyText) {
  return `
    <div>
      <div class="col-label"><span class="dot ${dotClass}"></span><span class="txt">${label}</span></div>
      <div class="col-list">${items.length ? items.map(cardHtml).join('') : `<div class="empty-note">${emptyText}</div>`}</div>
    </div>
  `;
}

function cardHtml(item) {
  const mine = me && item.user_id === me.id;
  const name = (item.profiles && item.profiles.display_name) || 'York student';
  const initial = (name.trim().charAt(0) || 'Y').toUpperCase();
  const sectionLabel = item.section || 'Any section';
  return `
    <button class="card${mine ? ' mine' : ''}" type="button"
      data-listing-id="${esc(item.id)}" data-user-id="${esc(item.user_id)}"
      data-name="${esc(name)}" data-initial="${esc(initial)}"
      data-course="${esc(item.subject + ' ' + item.course_number)}" data-section="${esc(sectionLabel)}">
      <div class="section">${esc(sectionLabel)}</div>
      <div class="campus">${esc(item.campus)}</div>
      ${item.note ? `<div class="note">${esc(item.note)}</div>` : ''}
      <div class="foot">
        <div class="who"><span class="avatar">${esc(initial)}</span><span class="name">${esc(mine ? 'You' : name)}</span></div>
        <span class="msg-cta">${mine ? 'Remove' : 'Message'}</span>
      </div>
    </button>
  `;
}

/* ============================== post form ============================== */

function wirePost() {
  el('back-from-post').addEventListener('click', () => showScreen('screen-board'));
  el('toggle-drop').addEventListener('click', () => setPostType('dropping'));
  el('toggle-need').addEventListener('click', () => setPostType('needed'));
  el('post-form').addEventListener('submit', submitListing);
}

function resetPostForm() {
  setPostType('dropping');
  el('post-form').reset();
  el('post-error').textContent = '';
}

function setPostType(t) {
  postType = t;
  el('toggle-drop').setAttribute('aria-pressed', t === 'dropping');
  el('toggle-need').setAttribute('aria-pressed', t === 'needed');
  el('toggle-hint').textContent = t === 'dropping' ? 'You have a seat you want to give up.' : 'You want a seat someone else is dropping.';
  el('btn-submit').classList.toggle('need', t === 'needed');
}

async function submitListing(e) {
  e.preventDefault();
  const errorEl = el('post-error');
  errorEl.textContent = '';

  if (!me) { errorEl.textContent = 'Please sign in again.'; return; }

  const subject = el('f-subject').value.trim().toUpperCase();
  const courseNumber = el('f-number').value.trim();
  const section = el('f-section').value.trim();
  const term = el('f-term').value;
  const campus = el('f-campus').value;
  const note = el('f-note').value.trim();

  if (!subject || !courseNumber) {
    errorEl.textContent = 'Subject and course number are required.';
    return;
  }

  const btn = el('btn-submit');
  btn.disabled = true;
  const { error } = await supabase.from('listings').insert({
    user_id: me.id,
    type: postType,
    subject,
    course_number: courseNumber,
    section: section || null,
    term,
    campus,
    note: note || null
  });
  btn.disabled = false;

  if (error) { errorEl.textContent = error.message; return; }

  const toast = el('toast');
  toast.classList.add('show');
  setTimeout(async () => {
    toast.classList.remove('show');
    resetPostForm();
    showScreen('screen-board');
    await refreshListings();
  }, 700);
}

/* ============================== DM ============================== */

function wireDM() {
  el('back-from-dm').addEventListener('click', closeDM);
  el('dm-send').addEventListener('click', sendMessage);
  el('dm-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
}

function closeDM() {
  if (messageChannel) { supabase.removeChannel(messageChannel); messageChannel = null; }
  currentConversation = null;
  showScreen('screen-board');
}

async function openDM(d) {
  if (!me) return;

  el('dm-avatar').textContent = d.initial;
  el('dm-name').textContent = d.name;
  el('dm-course').textContent = d.course + (d.section ? ' · ' + d.section : '');
  el('dm-swap').textContent = 'Re: ' + d.course + (d.section ? ' · ' + d.section : '');
  el('dm-thread').innerHTML = '<div class="loading-note">Loading conversation…</div>';
  showScreen('screen-dm');

  const convo = await findOrCreateConversation(d.listingId, d.userId);
  if (!convo) {
    el('dm-thread').innerHTML = '<div class="no-results">Couldn’t open this conversation.</div>';
    return;
  }

  currentConversation = convo;
  await loadMessages(convo.id);
  subscribeToConversation(convo.id);
}

async function findOrCreateConversation(listingId, otherUserId) {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id, listing_id, user_a, user_b')
    .eq('listing_id', listingId)
    .or(`and(user_a.eq.${me.id},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${me.id})`)
    .maybeSingle();

  if (findError) console.error(findError);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, user_a: me.id, user_b: otherUserId })
    .select('id, listing_id, user_a, user_b')
    .single();

  if (createError) { console.error(createError); return null; }
  return created;
}

async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); el('dm-thread').innerHTML = '<div class="no-results">Couldn’t load messages.</div>'; return; }
  el('dm-thread').innerHTML = (data || []).map(bubbleHtml).join('');
  el('dm-thread').scrollTop = el('dm-thread').scrollHeight;
}

function bubbleHtml(m) {
  const mine = me && m.sender_id === me.id;
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `
    <div class="msg-row ${mine ? 'me' : 'them'}">
      <div class="bubble">${esc(m.body)}</div>
      <div class="msg-time">${esc(time)}</div>
    </div>
  `;
}

function subscribeToConversation(conversationId) {
  if (messageChannel) supabase.removeChannel(messageChannel);
  messageChannel = supabase
    .channel('messages:' + conversationId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: 'conversation_id=eq.' + conversationId
    }, (payload) => {
      const thread = el('dm-thread');
      thread.insertAdjacentHTML('beforeend', bubbleHtml(payload.new));
      thread.scrollTop = thread.scrollHeight;
    })
    .subscribe();
}

async function sendMessage() {
  const input = el('dm-input');
  const body = input.value.trim();
  if (!body || !currentConversation || !me) return;
  input.value = '';
  const { error } = await supabase.from('messages').insert({
    conversation_id: currentConversation.id,
    sender_id: me.id,
    body
  });
  if (error) console.error(error);
}

boot();
