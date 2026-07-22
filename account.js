import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://qgzpoyyijafblzfiyhoc.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJxZ3pwb3l5aWphZmJsemZpeWhvYyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgyMzg5NzMyLCJleHAiOjIwOTc5NjU3MzJ9.g-INXAO6kNGwN750J5rreKlroMFFro7Bl9uJXcr-vug';
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

async function signInGoogle() {
  authStatus.textContent = 'Opening Google...';
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/account.html' } });
  if (error) authStatus.textContent = error.message;
}

async function sendMagicLink(e) {
  e.preventDefault();
  const email = new FormData(e.currentTarget).get('email');
  authStatus.textContent = 'Sending your sign-in link...';
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/account.html' } });
  authStatus.textContent = error ? error.message : 'Check your email for your sign-in link.';
}

async function loadAccount(session) {
  if (!session) { authBox.hidden = false; dashboard.hidden = true; return; }
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
  if (data) customer = data;
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
$('#googleSignIn').addEventListener('click', signInGoogle);
$('#magicLinkForm').addEventListener('submit', sendMagicLink);
$('#accountProfile').addEventListener('submit', saveProfile);
dashboard.addEventListener('click', accountAction);
$('#signOut').addEventListener('click', async () => { await supabase.auth.signOut(); location.reload(); });
supabase.auth.onAuthStateChange((_event, session) => loadAccount(session));
supabase.auth.getSession().then(({ data }) => loadAccount(data.session));
