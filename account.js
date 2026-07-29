import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://qgzpoyyijafblzfiyhoc.supabase.co';
const SB_ANON = 'sb_publishable_gNm_CC5dBdLLa8q6-XLp3A_Wbsvtgcz';
const supabase = createClient(SB_URL, SB_ANON);
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const authBox = $('#accountAuth');
const dashboard = $('#accountDashboard');
const authStatus = $('#authStatus');
let customer = null;
let occasions = [];
let orders = [];

const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pretty = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be confirmed';
const statusLabel = (s) => ({ enquiry: 'Enquiry', quoted: 'Quoted', deposit_paid: 'Deposit paid', baking: 'Baking', ready: 'Ready', completed: 'Completed' }[s] || s || 'Enquiry');
const paymentLabel = (s) => ({ unpaid: 'Unpaid', deposit_paid: 'Deposit paid', paid_in_full: 'Paid in full' }[s] || 'Unpaid');
const googleCalendarUrl = (title, date, details) => {
  const day = String(date || '').replaceAll('-', '');
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: day + '/' + day, details });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
};

const REDIRECT = location.origin + '/account.html';
const PROVIDERS = { google: 'Google' };
let pendingEmail = '';
// A recovery link signs the customer in, so the dashboard would otherwise open
// behind the "choose a new password" step and win the race.
let recoveryMode = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';

// Supabase speaks developer. Customers do not.
function friendly(error, fallback = 'Something went wrong. Please try again.') {
  const m = String(error?.message || '');
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match. Please try again.';
  if (/already registered/i.test(m)) return 'This email already has an account. Please sign in instead.';
  if (/not confirmed/i.test(m)) return 'Please confirm your email address first.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'That sign-in option is not switched on yet. Please use your email address instead.';
  if (/signups not allowed|disabled/i.test(m)) return 'New accounts are not open right now. Please contact Hazel.';
  if (/rate limit|too many|after \d+ seconds/i.test(m)) return 'Please wait a moment before trying again.';
  if (/password/i.test(m) && /short|least/i.test(m)) return 'Please use at least 8 characters for your password.';
  return m || fallback;
}

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cinematic swap: the outgoing panel lifts and blurs away, the incoming one
// rises through it and its fields stagger in behind it.
function enter(el) {
  el.classList.remove('is-entering');
  void el.offsetWidth; // restart the animation
  el.classList.add('is-entering');
  clearTimeout(el._enterT);
  el._enterT = setTimeout(() => el.classList.remove('is-entering'), 900);
}

function swap(outEl, inEl) {
  if (!inEl || outEl === inEl) return;
  if (!outEl || REDUCED) { if (outEl) outEl.hidden = true; inEl.hidden = false; return; }
  outEl.classList.add('is-leaving');
  clearTimeout(outEl._leaveT);
  outEl._leaveT = setTimeout(() => {
    outEl.classList.remove('is-leaving');
    outEl.hidden = true;
    inEl.hidden = false;
    enter(inEl);
  }, 300);
}

// Hidden required fields cannot be focused, so the browser refuses to submit.
// Only the step on screen carries the constraint.
function syncRequired(form) {
  $$('[data-signup-step]', form).forEach((step) => {
    $$('input[data-required]', step).forEach((input) => { input.required = !step.hidden; });
  });
}

function nextSignUpStep() {
  const form = $('#signUpForm');
  for (const input of [form.elements.full_name, form.elements.email]) {
    if (!input.reportValidity()) return;
  }
  authStatus.textContent = '';
  signUpStep(2);
}

function signUpStep(n) {
  const form = $('#signUpForm');
  const current = $$('[data-signup-step]', form).find((s) => !s.hidden);
  const next = $(`[data-signup-step="${n}"]`, form);
  if (!next || current === next) return;
  $('#signUpStepNum').textContent = String(n);
  swap(current, next);
  setTimeout(() => syncRequired(form), REDUCED ? 0 : 320);
}

function showPanel(name) {
  const next = $(`[data-auth-panel="${name}"]`);
  const current = $$('[data-auth-panel]').find((p) => !p.hidden);
  if (!next) return;
  // The tabs and social buttons only make sense while choosing how to get in.
  const chromeHidden = name === 'otp' || name === 'recovery';
  [$('.account-oauth'), $('.account-divider'), $('#authSwitch')].forEach((el) => { if (el) el.hidden = chromeHidden; });
  $$('[data-auth-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.authTab === name));
  $('#authSwitch').style.setProperty('--auth-tab', name === 'signup' ? '1' : '0');
  if (name === 'signup') {
    const form = $('#signUpForm');
    $$('[data-signup-step]', form).forEach((s) => { s.hidden = s.dataset.signupStep !== '1'; });
    $('#signUpStepNum').textContent = '1';
    syncRequired(form);
  }
  swap(current, next);
}

async function signInWithProvider(provider) {
  authStatus.textContent = `Opening ${PROVIDERS[provider]}...`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT },
  });
  if (error) authStatus.textContent = friendly(error);
}

async function signIn(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const email = String(f.get('email') || '').trim();
  const password = String(f.get('password') || '');
  authStatus.textContent = 'Signing you in...';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return;
  if (/not confirmed/i.test(error.message)) {
    pendingEmail = email;
    $('#otpTarget').textContent = email;
    await supabase.auth.resend({ type: 'signup', email });
    showPanel('otp');
    authStatus.textContent = 'Please confirm your email first. We have sent you a new code.';
    return;
  }
  authStatus.textContent = friendly(error);
}

async function createAccount(e) {
  e.preventDefault();
  // Enter on the first step means "continue", not "create my account".
  if ($('[data-signup-step="2"]').hidden) { nextSignUpStep(); return; }
  const f = new FormData(e.currentTarget);
  const full_name = String(f.get('full_name') || '').trim();
  const email = String(f.get('email') || '').trim();
  const password = String(f.get('password') || '');
  if (password.length < 8) { authStatus.textContent = 'Please use at least 8 characters for your password.'; return; }
  if (password !== String(f.get('confirm_password') || '')) { authStatus.textContent = 'Those two passwords do not match.'; return; }
  authStatus.textContent = 'Creating your account...';
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: REDIRECT } });
  if (error) { authStatus.textContent = friendly(error); return; }
  // Supabase returns a user with no identities when the email is already taken.
  if (data.user && !data.user.identities?.length) {
    showPanel('signin');
    authStatus.textContent = 'This email already has an account. Please sign in instead.';
    return;
  }
  if (data.session) return; // Confirmation is switched off, so they are already in.
  pendingEmail = email;
  $('#otpTarget').textContent = email;
  showPanel('otp');
  authStatus.textContent = 'Check your email for your confirmation code.';
}

async function confirmEmail(e) {
  e.preventDefault();
  const token = String(new FormData(e.currentTarget).get('token') || '').replace(/\s/g, '');
  authStatus.textContent = 'Checking your code...';
  const { error } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: 'signup' });
  if (error) authStatus.textContent = 'That code is not right, or it has expired. Try again or send a new one.';
}

async function resendCode() {
  if (!pendingEmail) return;
  authStatus.textContent = 'Sending a new code...';
  const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
  authStatus.textContent = error ? friendly(error) : 'A new code is on its way.';
}

async function forgotPassword() {
  const email = String($('#signInForm').elements.email.value || '').trim();
  if (!email) { authStatus.textContent = 'Please type your email address first, then tap this again.'; return; }
  authStatus.textContent = 'Sending your reset link...';
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT });
  authStatus.textContent = error ? friendly(error) : 'Check your email for a link to set a new password.';
}

async function setNewPassword(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const password = String(f.get('password') || '');
  if (password.length < 8) { authStatus.textContent = 'Please use at least 8 characters for your password.'; return; }
  if (password !== String(f.get('confirm_password') || '')) { authStatus.textContent = 'Those two passwords do not match.'; return; }
  authStatus.textContent = 'Saving your new password...';
  const { error } = await supabase.auth.updateUser({ password });
  if (error) { authStatus.textContent = friendly(error); return; }
  recoveryMode = false;
  showPanel('signin');
  const { data } = await supabase.auth.getSession();
  loadAccount(data.session);
}

// Names the account after the customer, with the right possessive apostrophe.
const setNavName = (fullName) => window.hclSetAccountName?.(fullName || '');

async function loadAccount(session) {
  if (recoveryMode) { authBox.hidden = false; dashboard.hidden = true; showPanel('recovery'); return; }
  if (!session) { authBox.hidden = false; dashboard.hidden = true; setNavName(''); return; }
  const { data: rows, error } = await supabase.from('customers').select('*').eq('auth_user_id', session.user.id).limit(1);
  if (error || !rows?.length) {
    authBox.hidden = false; dashboard.hidden = true;
    authStatus.textContent = error?.message || 'Your account is still being prepared. Please sign in again.';
    return;
  }
  customer = rows[0];
  // This secured function deduplicates server-side, so it is safe to call on
  // every signed-in load. It only alerts Hazel for a genuinely new account.
  void supabase.functions.invoke('account-created-alert').catch(() => {});
  const [datesRes, ordersRes] = await Promise.all([
    supabase.from('circle_members').select('*').eq('customer_id', customer.id).order('occasion_date'),
    supabase.from('orders').select('id,status,payment_status,total_amount_zar,amount_paid_zar,occasion_date,cake_flavour,cake_description,delivery_or_collection,invoice_path,receipt_path,created_at,circle_member:circle_members(person_name,occasion_type)').eq('customer_id', customer.id).order('occasion_date'),
  ]);
  occasions = datesRes.data || [];
  orders = ordersRes.data || [];
  authBox.hidden = true; dashboard.hidden = false;
  $('#accountName').textContent = (customer.full_name || session.user.email).split(' ')[0];
  setNavName(customer.full_name);
  fillProfile(); renderAll(); setUpProvince();
  // The tabs have no width until the dashboard is on screen.
  requestAnimationFrame(moveTabInk);
}

function calendarItems() {
  return [
    ...occasions.map((o) => ({ date: o.occasion_date, type: 'Saved date', title: `${o.person_name}'s ${o.occasion_type}`, detail: 'No cake is booked yet.' })),
    ...orders.map((o) => ({ date: o.occasion_date, type: 'Cake order', title: o.circle_member ? `${o.circle_member.person_name}'s ${o.circle_member.occasion_type}` : (o.cake_description || 'Cake order'), detail: `${statusLabel(o.status)}. ${paymentLabel(o.payment_status)}.` })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let calCursor = null;   // first day of the month on screen
let calSelected = null; // 'YYYY-MM-DD'

const OCCASIONS = ['Birthday','Anniversary','Wedding','Baby shower','Graduation','Engagement','Baptism','Retirement','Just because','Other'];
let editingDate = null;

// The site holds every cake date to four full days' notice.
const earliestDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  return ymd(d);
};

function dateEditor(o) {
  const options = OCCASIONS.concat(OCCASIONS.includes(o.occasion_type) ? [] : [o.occasion_type])
    .map((t) => `<option value="${safe(t)}"${t === o.occasion_type ? ' selected' : ''}>${safe(t)}</option>`).join('');
  return `<form class="ecard ecard--editing" data-save-date="${o.id}">
    <div class="ecard__body ecard__edit">
      <div class="form__row">
        <label class="field"><span>Who is it for</span><input name="person_name" value="${safe(o.person_name || '')}" required /></label>
        <label class="field"><span>Occasion</span><select name="occasion_type" required>${options}</select></label>
      </div>
      <div class="form__row">
        <label class="field"><span>Date</span><input type="date" name="occasion_date" value="${safe(o.occasion_date || '')}" min="${earliestDate()}" required /></label>
        <label class="consent ecard__repeat"><input type="checkbox" name="recurring_yearly"${o.recurring_yearly ? ' checked' : ''} /><span class="consent__box" aria-hidden="true"></span><span>Remind me every year</span></label>
      </div>
      <div class="ecard__actions ecard__actions--edit">
        <button type="submit">Save changes</button>
        <button type="button" data-cancel-date>Cancel</button>
      </div>
    </div>
  </form>`;
}

// Compact date plate used on every card.
const dateBlock = (d) => d
  ? `<div class="ecard__date"><b>${Number(d.slice(8, 10))}</b><span>${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}</span><i>${d.slice(0, 4)}</i></div>`
  : '<div class="ecard__date ecard__date--tbc"><b>&middot;</b><span>TBC</span></div>';

function itemsByDate() {
  const map = new Map();
  calendarItems().forEach((item) => {
    if (!item.date) return;
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  });
  return map;
}

function dayDetail(map) {
  const todayKey = ymd(new Date());
  // With nothing chosen, show the next date that has something on it.
  const key = calSelected || [...map.keys()].filter((k) => k >= todayKey).sort()[0];
  const items = key ? (map.get(key) || []) : [];
  if (!items.length) return empty(calSelected ? 'Nothing saved on this date.' : 'No dates or orders yet.');
  return items.map((item) => `
    <article class="ecard">
      ${dateBlock(item.date)}
      <div class="ecard__body">
        <h3>${safe(item.title)}</h3>
        <p class="chips"><em class="chip">${safe(item.type)}</em></p>
        <p class="ecard__note">${safe(item.detail)}</p>
      </div>
      <div class="ecard__actions"><a class="ecard__link" href="${safe(googleCalendarUrl(item.title, item.date, item.detail))}" target="_blank" rel="noopener">Add to Google Calendar</a></div>
    </article>`).join('');
}

function renderCalendar() {
  const map = itemsByDate();
  const todayKey = ymd(new Date());
  if (!calCursor) {
    const next = [...map.keys()].filter((k) => k >= todayKey).sort()[0] || todayKey;
    calCursor = new Date(Number(next.slice(0, 4)), Number(next.slice(5, 7)) - 1, 1);
  }
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // weeks start on Monday
  const total = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push('<span class="cal__pad"></span>');
  for (let day = 1; day <= total; day += 1) {
    const key = ymd(new Date(year, month, day));
    const marked = map.has(key);
    const classes = ['cal__day', marked ? 'is-marked' : '', key === todayKey ? 'is-today' : '', key === calSelected ? 'is-selected' : ''].filter(Boolean).join(' ');
    const label = marked ? ` aria-label="${map.get(key).length} on ${day} ${MONTHS[month]}"` : '';
    cells.push(`<button type="button" class="${classes}" data-date="${key}"${label}><span>${day}</span></button>`);
  }

  $('#accountCalendar').innerHTML = `
    <div class="cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" data-cal-step="-1" aria-label="Previous month">&#8249;</button>
        <h3 class="cal__month">${MONTHS[month]} ${year}</h3>
        <button type="button" class="cal__nav" data-cal-step="1" aria-label="Next month">&#8250;</button>
      </div>
      <div class="cal__grid">${DOW.map((d) => `<span class="cal__dow">${d}</span>`).join('')}${cells.join('')}</div>
    </div>
    <div class="cal__detail">${dayDetail(map)}</div>`;
}

function renderAll() {
  renderCalendar();

  $('#accountOrders').innerHTML = orders.length ? orders.map((o) => {
    const title = o.circle_member ? `${o.circle_member.person_name}'s ${o.circle_member.occasion_type}` : (o.cake_description || 'Cake order');
    const total = Number(o.total_amount_zar || 0);
    const paid = Number(o.amount_paid_zar || 0);
    const owing = Math.max(total - paid, 0);
    const money = o.total_amount_zar == null
      ? '<p class="account-card__note">Hazel is still working out your quote.</p>'
      : `<p class="account-card__note">R${paid.toFixed(2)} paid of R${total.toFixed(2)}${owing > 0 ? `, R${owing.toFixed(2)} still to pay` : '. Fully paid, thank you'}</p>
         <span class="bar"><i style="width:${total ? Math.min(100, (paid / total) * 100).toFixed(0) : 0}%"></i></span>`;
    return `<article class="ecard ecard--order">
      ${dateBlock(o.occasion_date)}
      <div class="ecard__body">
        <h3>${safe(title)}</h3>
        <p class="chips"><em class="chip chip--${safe(o.status || 'enquiry')}">${safe(statusLabel(o.status))}</em><em class="chip chip--pay-${safe(o.payment_status || 'unpaid')}">${safe(paymentLabel(o.payment_status))}</em></p>
        ${money}
      </div>
      <div class="ecard__actions">
        <button data-reorder="${o.id}">Order this again</button>
        ${o.invoice_path ? `<button data-file="invoice" data-order="${o.id}">Invoice</button>` : ''}
        ${o.receipt_path ? `<button data-file="receipt" data-order="${o.id}">Receipt</button>` : ''}
      </div></article>`;
  }).join('') : empty('No cakes ordered yet. When you send an enquiry it will appear here, and you can follow it from quote to collection.');

  $('#accountDates').innerHTML = occasions.length ? occasions.map((o) => (
    editingDate === o.id ? dateEditor(o) : `
    <article class="ecard ecard--date">
      ${dateBlock(o.occasion_date)}
      <div class="ecard__body">
        <h3>${safe(o.person_name)} &middot; ${safe(o.occasion_type)}</h3>
        <p class="chips"><em class="chip"><i class="pip" aria-hidden="true"></i>${o.recurring_yearly ? 'Every year' : 'One time'}</em><em class="chip">No cake booked</em></p>
        <p class="ecard__note">${o.recurring_yearly ? 'I will remind you a month, two weeks and a week before, every year.' : 'I will remind you in good time before this date arrives.'}</p>
      </div>
      <div class="ecard__actions"><button data-edit-date="${o.id}">Edit</button><button data-delete-date="${o.id}">Remove</button></div>
    </article>`)).join('') : empty('No dates saved yet. Add the birthdays and anniversaries you never want to miss and I will remind you, free, with no cake booked.');
}

const empty = (message) => `<p class="account-empty">${safe(message)}</p>`;

// The customers table has a CHECK constraint on province, so only these nine
// values may ever reach the database.
const PROVINCES = ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'];
const matchProvince = (value) => PROVINCES.find((p) => p.toLowerCase() === String(value || '').trim().toLowerCase()) || null;

function setUpProvince() {
  const input = $('#provinceInput');
  const list = $('#provinceList');
  if (!input || !list) return;
  let active = -1;

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const options = () => $$('li[data-value]', list);

  const open = () => {
    const typed = input.value.trim().toLowerCase();
    const exact = matchProvince(input.value);
    // A chosen value should still show the whole list, not just itself.
    const shown = (!typed || exact) ? PROVINCES : PROVINCES.filter((p) => p.toLowerCase().includes(typed));
    list.innerHTML = shown.length
      ? shown.map((p) => `<li role="option" data-value="${safe(p)}" aria-selected="${p === exact}">${safe(p)}</li>`).join('')
      : '<li class="combo__empty">No province matches that</li>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  };

  const choose = (value) => { input.value = value; close(); };

  input.addEventListener('focus', open);
  input.addEventListener('input', open);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    const items = options();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) { open(); return; }
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('is-active', i === active));
      items[active]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      if (!list.hidden && items.length) { e.preventDefault(); choose(items[Math.max(active, 0)].dataset.value); }
    }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-value]');
    if (li) { e.preventDefault(); choose(li.dataset.value); }
  });
  // Anything that is not one of the nine is not a province.
  input.addEventListener('blur', () => {
    setTimeout(() => { input.value = matchProvince(input.value) || ''; close(); }, 120);
  });
}

function fillProfile() {
  const form = $('#accountProfile');
  ['full_name','whatsapp_number','address_line_1','address_line_2','suburb','city','province','postal_code'].forEach((name) => { form.elements[name].value = customer[name] || ''; });
  ['email_consent','whatsapp_consent','phone_call_consent'].forEach((name) => { form.elements[name].checked = !!customer[name]; });
  const emailField = $('#emailChangeForm')?.elements.new_email;
  if (emailField) emailField.value = customer.email || '';
}

async function saveProfile(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const phone = String(f.get('whatsapp_number') || '').trim();
  if (phone && !/^(?:\+27|0)[6-8]\d{8}$/.test(phone.replace(/\s/g, ''))) { $('#profileStatus').textContent = 'Please enter a valid South African phone number.'; return; }
  const payload = Object.fromEntries(['full_name','whatsapp_number','address_line_1','address_line_2','suburb','city','province','postal_code'].map((n) => [n, String(f.get(n) || '').trim() || null]));
  payload.province = matchProvince(payload.province); // the column only accepts the nine
  ['email_consent','whatsapp_consent','phone_call_consent'].forEach((n) => { payload[n] = e.currentTarget.elements[n].checked; });
  // POPIA: record when WhatsApp consent was actually given, not just that it is on.
  if (payload.whatsapp_consent && !customer.whatsapp_consent) payload.whatsapp_consent_date = new Date().toISOString();
  if (!payload.whatsapp_consent) payload.whatsapp_consent_date = null;
  const { data, error } = await supabase.from('customers').update(payload).eq('id', customer.id).select().single();
  $('#profileStatus').textContent = error ? error.message : 'Your details are saved.';
  if (data) { customer = data; setNavName(customer.full_name); $('#accountName').textContent = String(customer.full_name || '').split(' ')[0] || 'there'; }
}

const securityStatus = () => $('#securityStatus');

// Re-reads the customer's dates and orders without throwing away the page.
async function refreshData() {
  const [datesRes, ordersRes] = await Promise.all([
    supabase.from('circle_members').select('*').eq('customer_id', customer.id).order('occasion_date'),
    supabase.from('orders').select('id,status,payment_status,total_amount_zar,amount_paid_zar,occasion_date,cake_flavour,cake_description,delivery_or_collection,invoice_path,receipt_path,created_at,circle_member:circle_members(person_name,occasion_type)').eq('customer_id', customer.id).order('occasion_date'),
  ]);
  occasions = datesRes.data || occasions;
  orders = ordersRes.data || orders;
  renderAll();
}

async function saveDate(e) {
  e.preventDefault();
  const id = e.currentTarget.dataset.saveDate;
  const f = new FormData(e.currentTarget);
  const patch = {
    person_name: String(f.get('person_name') || '').trim(),
    occasion_type: String(f.get('occasion_type') || '').trim(),
    occasion_date: String(f.get('occasion_date') || ''),
    recurring_yearly: e.currentTarget.elements.recurring_yearly.checked,
  };
  if (!patch.person_name || !patch.occasion_date) return;
  if (patch.occasion_date < earliestDate()) { alert('Please choose a date at least four days from now, so there is time to bake.'); return; }
  const { error } = await supabase.from('circle_members').update(patch).eq('id', id);
  if (error) { alert(error.message); return; }
  editingDate = null;
  await refreshData();
}

async function changeEmail(e) {
  e.preventDefault();
  const next = String(new FormData(e.currentTarget).get('new_email') || '').trim();
  if (!next || next.toLowerCase() === String(customer.email || '').toLowerCase()) {
    securityStatus().textContent = 'That is already your email address.';
    return;
  }
  securityStatus().textContent = 'Sending a code to your new address...';
  const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: REDIRECT });
  if (error) { securityStatus().textContent = friendly(error); return; }
  pendingEmail = next;
  $('#emailChangeTarget').textContent = next;
  $('#emailOtpForm').hidden = false;
  securityStatus().textContent = 'Check the new address for your code. Your old email keeps working until you confirm.';
}

async function confirmEmailChange(e) {
  e.preventDefault();
  const token = String(new FormData(e.currentTarget).get('token') || '').replace(/\s/g, '');
  securityStatus().textContent = 'Checking your code...';
  const { error } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: 'email_change' });
  if (error) { securityStatus().textContent = 'That code is not right, or it has expired. Try changing your email again.'; return; }
  $('#emailOtpForm').hidden = true;
  e.currentTarget.reset();
  securityStatus().textContent = 'Your email address is updated. Use it next time you sign in.';
  const { data } = await supabase.auth.getSession();
  if (data.session) loadAccount(data.session);
}

async function changePassword(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const password = String(f.get('password') || '');
  if (password.length < 8) { securityStatus().textContent = 'Please use at least 8 characters.'; return; }
  if (password !== String(f.get('confirm_password') || '')) { securityStatus().textContent = 'Those two passwords do not match.'; return; }
  securityStatus().textContent = 'Saving your new password...';
  const { error } = await supabase.auth.updateUser({ password });
  securityStatus().textContent = error ? friendly(error) : 'Your password is updated.';
  if (!error) e.currentTarget.reset();
}

async function accountAction(e) {
  const reorder = e.target.closest('[data-reorder]');
  if (reorder) {
    const date = prompt('What date do you need the cake? Use YYYY-MM-DD.'); if (!date) return;
    const { error } = await supabase.rpc('request_reorder', { source_order_id: reorder.dataset.reorder, requested_date: date });
    alert(error ? error.message : 'Your new enquiry has been sent to Hazel.'); if (!error) location.reload(); return;
  }
  const edit = e.target.closest('[data-edit-date]');
  if (edit) { editingDate = edit.dataset.editDate; renderAll(); return; }
  const cancel = e.target.closest('[data-cancel-date]');
  if (cancel) { editingDate = null; renderAll(); return; }
  const remove = e.target.closest('[data-delete-date]');
  if (remove && confirm('Remove this saved date? Your reminders for it will stop.')) {
    const { error } = await supabase.from('circle_members').delete().eq('id', remove.dataset.deleteDate);
    if (error) { alert(error.message); return; }
    await refreshData();
  }
  const file = e.target.closest('[data-file]');
  if (file) {
    const { data, error } = await supabase.functions.invoke('customer-file', { body: { order_id: file.dataset.order, kind: file.dataset.file } });
    if (error || !data?.url) alert('This file is not available yet.'); else window.open(data.url, '_blank', 'noopener');
  }
}

// Slides the gold bar under whichever tab is active. Measured, not guessed,
// because the tabs are different widths and the strip scrolls on mobile.
function moveTabInk() {
  const tabs = $('.account-tabs');
  const active = $('[data-account-tab].is-active');
  if (!tabs || !active || !active.offsetWidth) return;
  let ink = $('.account-tabs__ink', tabs);
  if (!ink) { ink = document.createElement('span'); ink.className = 'account-tabs__ink'; tabs.append(ink); }
  tabs.style.setProperty('--tab-x', `${active.offsetLeft}px`);
  tabs.style.setProperty('--tab-w', `${active.offsetWidth}px`);
}

$$('[data-account-tab]').forEach((button) => button.addEventListener('click', () => {
  $$('[data-account-tab]').forEach((b) => b.classList.toggle('is-active', b === button));
  $$('[data-account-panel]').forEach((p) => p.classList.toggle('is-active', p.dataset.accountPanel === button.dataset.accountTab));
  button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  moveTabInk();
}));
addEventListener('resize', moveTabInk);
$('#googleSignIn').addEventListener('click', () => signInWithProvider('google'));
$$('[data-auth-tab]').forEach((b) => b.addEventListener('click', () => { showPanel(b.dataset.authTab); authStatus.textContent = ''; }));
$('#signUpNext').addEventListener('click', nextSignUpStep);
$('#signUpBack').addEventListener('click', () => { authStatus.textContent = ''; signUpStep(1); });
$('#signInForm').addEventListener('submit', signIn);
$('#signUpForm').addEventListener('submit', createAccount);
$('#otpForm').addEventListener('submit', confirmEmail);
$('#newPasswordForm').addEventListener('submit', setNewPassword);
$('#forgotPassword').addEventListener('click', forgotPassword);
$('#resendCode').addEventListener('click', resendCode);
$('#accountProfile').addEventListener('submit', saveProfile);
$('#emailChangeForm').addEventListener('submit', changeEmail);
$('#emailOtpForm').addEventListener('submit', confirmEmailChange);
$('#passwordChangeForm').addEventListener('submit', changePassword);
// Bound to the container, so it survives every re-render of the grid.
$('#accountCalendar').addEventListener('click', (e) => {
  const step = e.target.closest('[data-cal-step]');
  if (step) {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + Number(step.dataset.calStep), 1);
    renderCalendar();
    return;
  }
  const day = e.target.closest('[data-date]');
  if (day) {
    calSelected = calSelected === day.dataset.date ? null : day.dataset.date;
    renderCalendar();
  }
});
dashboard.addEventListener('click', accountAction);
dashboard.addEventListener('submit', (e) => { if (e.target.matches('[data-save-date]')) saveDate(e); });
$('#signOut').addEventListener('click', async () => { await supabase.auth.signOut(); setNavName(''); location.reload(); });

// A cancelled or expired social sign-in comes back as an error in the URL, not a session.
const urlError = new URLSearchParams(location.hash.slice(1)).get('error_description')
  || new URLSearchParams(location.search).get('error_description');
if (urlError) {
  authStatus.textContent = decodeURIComponent(urlError).replace(/\+/g, ' ');
  history.replaceState(null, '', location.pathname);
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryMode = true;
    authBox.hidden = false; dashboard.hidden = true;
    showPanel('recovery');
    authStatus.textContent = 'Choose your new password.';
    return;
  }
  loadAccount(session);
});
supabase.auth.getSession().then(({ data }) => loadAccount(data.session));
