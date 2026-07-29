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
const PROVIDERS = { google: 'Google', facebook: 'Facebook' };
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
    options: { redirectTo: REDIRECT, ...(provider === 'facebook' ? { scopes: 'email,public_profile' } : {}) },
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
  const [datesRes, ordersRes] = await Promise.all([
    supabase.from('circle_members').select('*').eq('customer_id', customer.id).order('occasion_date'),
    supabase.from('orders').select('id,status,payment_status,total_amount_zar,amount_paid_zar,occasion_date,cake_flavour,cake_description,delivery_or_collection,invoice_path,receipt_path,created_at,circle_member:circle_members(person_name,occasion_type)').eq('customer_id', customer.id).order('occasion_date'),
  ]);
  occasions = datesRes.data || [];
  orders = ordersRes.data || [];
  authBox.hidden = true; dashboard.hidden = false;
  $('#accountName').textContent = (customer.full_name || session.user.email).split(' ')[0];
  setNavName(customer.full_name);
  fillProfile(); renderAll();
}

function calendarItems() {
  return [
    ...occasions.map((o) => ({ date: o.occasion_date, type: 'Saved date', title: `${o.person_name}'s ${o.occasion_type}`, detail: 'No cake is booked yet.' })),
    ...orders.map((o) => ({ date: o.occasion_date, type: 'Cake order', title: o.circle_member ? `${o.circle_member.person_name}'s ${o.circle_member.occasion_type}` : (o.cake_description || 'Cake order'), detail: `${statusLabel(o.status)}. ${paymentLabel(o.payment_status)}.` })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function renderAll() {
  const calendar = calendarItems();
  $('#accountCalendar').innerHTML = calendar.length ? calendar.map((item) => `
    <article class="account-event"><time>${safe(pretty(item.date))}</time><div><span>${safe(item.type)}</span><h3>${safe(item.title)}</h3><p>${safe(item.detail)}</p></div>
    <a href="${safe(googleCalendarUrl(item.title, item.date, item.detail))}" target="_blank" rel="noopener">Add to Google Calendar</a></article>`).join('') : empty('No dates or orders yet.');

  $('#accountOrders').innerHTML = orders.length ? orders.map((o) => {
    const title = o.circle_member ? `${o.circle_member.person_name}'s ${o.circle_member.occasion_type}` : (o.cake_description || 'Cake order');
    return `<article class="account-card"><div><span>${safe(pretty(o.occasion_date))}</span><h3>${safe(title)}</h3><p>${safe(statusLabel(o.status))} · ${safe(paymentLabel(o.payment_status))}</p>${o.total_amount_zar != null ? `<p>R ${Number(o.amount_paid_zar || 0).toFixed(2)} paid of R ${Number(o.total_amount_zar).toFixed(2)}</p>` : ''}</div><div class="account-card__actions"><button data-reorder="${o.id}">Order this again</button>${o.invoice_path ? `<button data-file="invoice" data-order="${o.id}">Invoice</button>` : ''}${o.receipt_path ? `<button data-file="receipt" data-order="${o.id}">Receipt</button>` : ''}</div></article>`;
  }).join('') : empty('No cake orders yet.');

  $('#accountDates').innerHTML = occasions.length ? occasions.map((o) => `<article class="account-card"><div><span>${safe(pretty(o.occasion_date))}</span><h3>${safe(o.person_name)} · ${safe(o.occasion_type)}</h3><p>${o.recurring_yearly ? 'Repeats every year' : 'Saved once'}</p></div><div class="account-card__actions"><button data-edit-date="${o.id}">Change date</button><button data-delete-date="${o.id}">Remove</button></div></article>`).join('') : empty('No saved dates yet.');
}

const empty = (message) => `<p class="account-empty">${safe(message)}</p>`;

function fillProfile() {
  const form = $('#accountProfile');
  ['full_name','whatsapp_number','address_line_1','address_line_2','suburb','city','province','postal_code'].forEach((name) => { form.elements[name].value = customer[name] || ''; });
  ['email_consent','whatsapp_consent','phone_call_consent'].forEach((name) => { form.elements[name].checked = !!customer[name]; });
}

async function saveProfile(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const phone = String(f.get('whatsapp_number') || '').trim();
  if (phone && !/^(?:\+27|0)[6-8]\d{8}$/.test(phone.replace(/\s/g, ''))) { $('#profileStatus').textContent = 'Please enter a valid South African phone number.'; return; }
  const payload = Object.fromEntries(['full_name','whatsapp_number','address_line_1','address_line_2','suburb','city','province','postal_code'].map((n) => [n, String(f.get(n) || '').trim() || null]));
  ['email_consent','whatsapp_consent','phone_call_consent'].forEach((n) => { payload[n] = e.currentTarget.elements[n].checked; });
  const { data, error } = await supabase.from('customers').update(payload).eq('id', customer.id).select().single();
  $('#profileStatus').textContent = error ? error.message : 'Your details are saved.';
  if (data) { customer = data; setNavName(customer.full_name); $('#accountName').textContent = String(customer.full_name || '').split(' ')[0] || 'there'; }
}

async function accountAction(e) {
  const reorder = e.target.closest('[data-reorder]');
  if (reorder) {
    const date = prompt('What date do you need the cake? Use YYYY-MM-DD.'); if (!date) return;
    const { error } = await supabase.rpc('request_reorder', { source_order_id: reorder.dataset.reorder, requested_date: date });
    alert(error ? error.message : 'Your new enquiry has been sent to Hazel.'); if (!error) location.reload(); return;
  }
  const edit = e.target.closest('[data-edit-date]');
  if (edit) {
    const date = prompt('Enter the new date as YYYY-MM-DD.'); if (!date) return;
    const { error } = await supabase.from('circle_members').update({ occasion_date: date }).eq('id', edit.dataset.editDate);
    alert(error ? error.message : 'Date updated.'); if (!error) location.reload(); return;
  }
  const remove = e.target.closest('[data-delete-date]');
  if (remove && confirm('Remove this saved date?')) { const { error } = await supabase.from('circle_members').delete().eq('id', remove.dataset.deleteDate); if (error) alert(error.message); else location.reload(); }
  const file = e.target.closest('[data-file]');
  if (file) {
    const { data, error } = await supabase.functions.invoke('customer-file', { body: { order_id: file.dataset.order, kind: file.dataset.file } });
    if (error || !data?.url) alert('This file is not available yet.'); else window.open(data.url, '_blank', 'noopener');
  }
}

$$('[data-account-tab]').forEach((button) => button.addEventListener('click', () => {
  $$('[data-account-tab]').forEach((b) => b.classList.toggle('is-active', b === button));
  $$('[data-account-panel]').forEach((p) => p.classList.toggle('is-active', p.dataset.accountPanel === button.dataset.accountTab));
}));
$('#googleSignIn').addEventListener('click', () => signInWithProvider('google'));
$('#facebookSignIn').addEventListener('click', () => signInWithProvider('facebook'));
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
dashboard.addEventListener('click', accountAction);
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
