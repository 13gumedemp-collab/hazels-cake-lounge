import { createClient } from '@supabase/supabase-js';
import {
  OCCASIONS, RELATIONSHIPS, OCCASION_OTHER, optionsHtml, repeatsByDefault, canonicalOccasion,
  isSelf, possessive, occasionTitle, personLabel, accentFor,
} from './occasions.js';

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
let sentLog = [];
let sentLogAll = false; // the log shows a first page until they ask for the rest

const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pretty = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be confirmed';
const statusLabel = (s) => ({ enquiry: 'Enquiry', quoted: 'Quoted', deposit_paid: 'Deposit paid', baking: 'Baking', ready: 'Ready', completed: 'Completed' }[s] || s || 'Enquiry');
const paymentLabel = (s) => ({ unpaid: 'Unpaid', deposit_paid: 'Deposit paid', paid_in_full: 'Paid in full' }[s] || 'Unpaid');

// Everything the customer told me on the enquiry form, so the order card can
// show it all back to them.
const ORDER_FIELDS = 'id,circle_member_id,status,payment_status,total_amount_zar,amount_paid_zar,occasion_date,order_date,cake_flavour,cake_description,colours_and_themes,number_of_people,delivery_or_collection,delivery_address,cake_photo_url,inspiration_photo_url,invoice_path,receipt_path,created_at,circle_member:circle_members(person_name,occasion_type,relationship_to_customer,notes)';

const REDIRECT = location.origin + '/account.html';
const PROVIDERS = { google: 'Google' };
let pendingEmail = '';
// A recovery link signs the customer in, so the dashboard would otherwise open
// behind the "choose a new password" step and win the race. Set this only from
// Supabase's PASSWORD_RECOVERY event: an old recovery hash must never hijack a
// normal sign-up or sign-in journey.
let recoveryMode = false;

function clearRecoveryState() {
  recoveryMode = false;
  if (new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery') {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

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
  for (const input of [form.elements.first_name, form.elements.last_name, form.elements.email]) {
    if (!input.reportValidity()) return;
  }
  authStatus.textContent = '';
  signUpStep(2);
}

function nextSignUpStep2() {
  const form = $('#signUpForm');
  const password = String(form.elements.password.value || '');
  if (password.length < 8) { authStatus.textContent = 'Please use at least 8 characters for your password.'; return; }
  if (password !== String(form.elements.confirm_password.value || '')) { authStatus.textContent = 'Those two passwords do not match.'; return; }
  authStatus.textContent = '';
  signUpStep(3);
}

function signUpStep(n) {
  const form = $('#signUpForm');
  const current = $$('[data-signup-step]', form).find((s) => !s.hidden);
  const next = $(`[data-signup-step="${n}"]`, form);
  if (!next || current === next) return;
  $('#signUpStepNum').textContent = String(n);
  swap(current, next);
  if (n === 3) setTimeout(syncSignUpPrefs, REDUCED ? 0 : 340);
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
  clearRecoveryState();
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

const syncSignUpPrefs = () => {};

async function createAccount(e) {
  e.preventDefault();
  // Enter part way through means "continue", not "create my account".
  if ($('[data-signup-step="2"]').hidden) { nextSignUpStep(); return; }
  if ($('[data-signup-step="3"]').hidden) { nextSignUpStep2(); return; }
  const f = new FormData(e.currentTarget);
  const first_name = String(f.get('first_name') || '').trim();
  const last_name = String(f.get('last_name') || '').trim();
  const full_name = [first_name, last_name].filter(Boolean).join(' ');
  const email = String(f.get('email') || '').trim();
  const password = String(f.get('password') || '');
  if (password.length < 8) { authStatus.textContent = 'Please use at least 8 characters for your password.'; return; }
  if (password !== String(f.get('confirm_password') || '')) { authStatus.textContent = 'Those two passwords do not match.'; return; }
  const el = e.currentTarget.elements;
  clearRecoveryState();
  authStatus.textContent = 'Creating your account...';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: REDIRECT,
      data: {
        first_name, last_name, full_name,
        email_consent: el.email_consent.checked,
        whatsapp_consent: el.whatsapp_consent.checked,
      },
    },
  });
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
  clearRecoveryState();
  showPanel('signin');
  const { data } = await supabase.auth.getSession();
  loadAccount(data.session);
}

// Names the account after the customer, with the right possessive apostrophe.
const setNavName = (fullName) => window.hclSetAccountName?.(fullName || '');

// Cached so the save-a-date form does not ask a signed-in customer for a name
// and email it already has. Their own name and address on their own device, the
// same as the first name already cached for the nav link. Cleared on sign out.
// Drops the "One moment..." placeholder once we know which panel to show.
const doneChecking = () => { const c = $('#accountChecking'); if (c) c.hidden = true; };

const ME_KEY = 'hcl.me';
function cacheMe(c) {
  try {
    const full = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || String(c?.full_name || '').trim();
    if (full && c?.email) localStorage.setItem(ME_KEY, JSON.stringify({ full_name: full, email: c.email }));
    else localStorage.removeItem(ME_KEY);
  } catch { /* private mode */ }
}
const forgetMe = () => { try { localStorage.removeItem(ME_KEY); } catch { /* private mode */ } };

async function loadAccount(session) {
  if (recoveryMode) { doneChecking(); authBox.hidden = false; dashboard.hidden = true; showPanel('recovery'); return; }
  if (!session) { doneChecking(); authBox.hidden = false; dashboard.hidden = true; setNavName(''); return; }
  const { data: rows, error } = await supabase.from('customers').select('*').eq('auth_user_id', session.user.id).limit(1);
  if (error || !rows?.length) {
    doneChecking(); authBox.hidden = false; dashboard.hidden = true;
    authStatus.textContent = error?.message || 'Your account is still being prepared. Please sign in again.';
    return;
  }
  customer = rows[0];
  // This secured function deduplicates server-side, so it is safe to call on
  // every signed-in load. It only alerts Hazel for a genuinely new account.
  void supabase.functions.invoke('account-created-alert').catch(() => {});
  // One customer-login event per day keeps the admin feed useful without turning
  // ordinary page refreshes into noise. New accounts are already announced separately.
  void supabase.functions.invoke('account-login-activity').catch(() => {});
  const [datesRes, ordersRes, sentRes] = await Promise.all([
    supabase.from('circle_members').select('*').eq('customer_id', customer.id).order('occasion_date'),
    supabase.from('orders').select(ORDER_FIELDS).eq('customer_id', customer.id).order('occasion_date'),
    // reminder_log has held every send since the start, and customers already
    // have RLS read access to their own rows, so the sent log needs no new table.
    supabase.from('reminder_log').select('id,reminder_type,channel,status,sent_at,error_message')
      .eq('customer_id', customer.id).order('sent_at', { ascending: false }).limit(100),
  ]);
  sentLog = sentRes.data || [];
  occasions = datesRes.data || [];
  orders = ordersRes.data || [];
  doneChecking(); authBox.hidden = true; dashboard.hidden = false;
  $('#accountName').textContent = customer.first_name || (customer.full_name || session.user.email).split(' ')[0];
  setNavName(customer.first_name || customer.full_name);
  cacheMe(customer);

  // Chosen before the panels render. It used to sit after them, so any error in
  // a render step skipped it silently and "Back to your calendar" landed on the
  // Overview. §4: one throw taking out everything after it is a repeat offender
  // in this file, so each step below stands on its own.
  const wantTab = new URLSearchParams(location.search).get('tab');
  if (wantTab) showAccountTab(wantTab);

  const step = (name, fn) => { try { fn(); } catch (e) { console.error(`account: ${name} failed`, e); } };
  step('fillProfile', fillProfile);
  step('renderAll', renderAll);
  step('setUpProvince', setUpProvince);
  setUpSecurity(session.user).catch((e) => console.error('account: setUpSecurity failed', e));

  // The tabs have no width until the dashboard is on screen.
  requestAnimationFrame(moveTabInk);
}

function calendarItems() {
  // Once a cake is ordered for an occasion, the order speaks for it. Showing the
  // saved date as well made the same celebration appear twice.
  const booked = new Set(orders.filter((o) => o.circle_member)
    .map((o) => `${o.occasion_date}|${o.circle_member.person_name}|${o.circle_member.occasion_type}`));
  return [
    ...occasions
      .filter((o) => !booked.has(`${o.occasion_date}|${o.person_name}|${o.occasion_type}`))
      .map((o) => ({ id: o.id, kind: 'date', date: o.occasion_date, type: 'Saved date', occasion_type: o.occasion_type, title: occasionTitle(o), detail: 'No cake is booked yet.' })),
    ...orders.map((o) => ({ id: o.id, kind: 'order', date: o.occasion_date, type: 'Cake order', occasion_type: o.circle_member?.occasion_type, title: orderTitle(o), detail: `${statusLabel(o.status)}. ${paymentLabel(o.payment_status)}.` })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let calCursor = null;   // first day of the month on screen
let calSelected = null; // 'YYYY-MM-DD'

let editingDate = null;
let orderTab = 'current'; // 'current' | 'history'
let openOrder = null;
let reorderFor = null;

// Everything the customer filled in, shown back to them exactly as given.
function orderDetail(o) {
  const cm = o.circle_member || {};
  const rows = [
    ['Occasion', cm.person_name ? `${cm.person_name}'s ${cm.occasion_type || 'celebration'}` : null],
    // "Their relationship to you: Myself" is not a sentence. When the cake is
    // for the customer, say so plainly instead.
    [isSelf(cm) ? 'Who it is for' : 'Their relationship to you', isSelf(cm) ? 'You' : cm.relationship_to_customer],
    ['Needed for', o.occasion_date ? pretty(o.occasion_date) : null],
    ['Flavour', o.cake_flavour],
    ['What you asked for', o.cake_description],
    ['Colours and theme', o.colours_and_themes],
    ['Number of people', o.number_of_people],
    ['Delivery or collection', o.delivery_or_collection],
    ['Delivery address', o.delivery_address],
    ['Your notes', cm.notes],
    ['Enquiry sent', o.created_at ? pretty(String(o.created_at).slice(0, 10)) : null],
  ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

  const photo = o.inspiration_photo_url || o.cake_photo_url;
  return `<div class="odetail">
    <h4>What you asked for</h4>
    <dl class="odetail__list">${rows.map(([k, v]) => `<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join('')}</dl>
    ${photo ? `<a class="odetail__photo" href="${safe(photo)}" target="_blank" rel="noopener"><img src="${safe(photo)}" alt="The inspiration picture you sent" loading="lazy" /></a>` : ''}
    <p class="odetail__foot">If any of this needs changing, reply to any email from me and I will sort it out.</p>
  </div>`;
}

function reorderForm(o) {
  const title = o.circle_member ? `${o.circle_member.person_name}'s ${o.circle_member.occasion_type}` : (o.cake_description || 'this cake');
  return `<form class="oreorder" data-reorder-form="${o.id}">
    <h4>Order this again</h4>
    <p>I will start a fresh enquiry for ${safe(title)} using the same details. Tell me when you need it and I will confirm and quote.</p>
    <div class="form__row">
      <label class="field"><span>When do you need it</span><input type="date" name="requested_date" min="${earliestDate()}" required /></label>
      <label class="field"><span>Anything different this time <em class="field__opt">(optional)</em></span><input type="text" name="note" placeholder="A different flavour, size, or colour" /></label>
    </div>
    <p class="account-fineprint account-fineprint--left">Every cake needs at least four full days' notice, so the earliest I can take is ${safe(pretty(earliestDate()))}.</p>
    <div class="ecard__actions ecard__actions--edit">
      <button type="submit">Send this enquiry</button>
      <button type="button" data-cancel-reorder>Cancel</button>
    </div>
  </form>`;
}

// The site holds every cake date to four full days' notice.
const earliestDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  return ymd(d);
};

// The reminder run is a month, two weeks and a week before. A date closer than
// that is allowed, the customer just needs to know what will actually reach them.
// Until migration 0013 is applied, the row level security policy still refuses
// any saved date inside four days, even though the page offers to save one and
// says honestly that it is too close for reminders. A raw policy violation
// message would be meaningless to a customer, so name the real cause.
function friendlyDateError(error, dateStr) {
  const m = String(error?.message || '');
  if (/row-level security|violates row-level/i.test(m)) {
    const days = Math.round((new Date(`${dateStr}T00:00:00`) - new Date(`${ymd(new Date())}T00:00:00`)) / 86400000);
    if (days < 4) return 'I cannot save a date this close yet. Please pick one at least four days away, or email me and I will add it by hand.';
  }
  return friendly(error);
}

function reminderNotice(dateStr, recurring) {
  if (!dateStr) return '';
  const days = Math.round((new Date(`${dateStr}T00:00:00`) - new Date(`${ymd(new Date())}T00:00:00`)) / 86400000);
  if (days < 0) {
    return recurring
      ? 'This date has already passed this year, so your reminders will begin next year.'
      : 'This date has already passed, so there is nothing left to remind you about.';
  }
  if (days < 7) {
    return recurring
      ? 'This is less than a week away, so there is no room for reminders this year. The full run starts next year.'
      : 'This is less than a week away, so I cannot get the usual reminders to you in time.';
  }
  if (days < 14) return 'Under two weeks away, so only the one week reminder will reach you this time.';
  if (days < 31) return 'Under a month away, so you will get the two week and one week reminders this time, and the full run from next year.';
  return '';
}

// Editing offers back everything the customer filled in on the save-a-date
// form, in the same order and the same words. It used to show only the name,
// occasion, date and repeat, so a relationship or a note they had written was
// invisible here and there was no way to change it.
function dateEditor(o) {
  // optionsHtml keeps an occasion saved before this list existed, so an older
  // "Baby Shower" row still shows as chosen rather than as an unknown extra.
  const options = optionsHtml(OCCASIONS, { placeholder: 'Choose an occasion', selected: o.occasion_type });
  const rels = optionsHtml(RELATIONSHIPS, { placeholder: 'Choose one', selected: o.relationship_to_customer });
  // One person_name column, two fields, same as the form that created it.
  const parts = String(o.person_name || '').trim().split(/\s+/);
  const first = parts.shift() || '';
  const last = parts.join(' ');
  return `<form class="ecard ecard--editing occ-editor" data-save-date="${o.id}">
    <div class="ecard__body ecard__edit">
      <p class="occ-block__head">Who is this date for?</p>
      <div class="form__row">
        <label class="field"><span>First name</span><input name="first_name" value="${safe(first)}" required /></label>
        <label class="field"><span>Surname</span><input name="last_name" value="${safe(last)}" /></label>
      </div>
      <label class="field"><span>Who are they to you?</span><select name="relationship_to_customer">${rels}</select></label>

      <p class="occ-block__head">What are we remembering?</p>
      <label class="field"><span>Occasion</span><select name="occasion_type" required>${options}</select></label>
      <label class="field"><span>Date</span><input type="date" name="occasion_date" value="${safe(o.occasion_date || '')}" required /></label>
      <label class="pref ecard__repeat"><input type="checkbox" name="recurring_yearly"${o.recurring_yearly ? ' checked' : ''} /><span class="pref__box" aria-hidden="true"></span><span>Remind me every year</span></label>

      <p class="occ-block__head">Anything else? <em class="field__opt">(optional)</em></p>
      <label class="field"><span>Cake ideas or notes</span><textarea name="notes" rows="2" placeholder="Add any ideas you already have">${safe(splitNotes(o.notes).text)}</textarea></label>

      <div class="occ-pics">
        <span class="field__label">Inspiration pictures <em class="field__opt">(up to ${MAX_PICTURES})</em></span>
        <div class="enq__thumbs occ-pics__thumbs" data-edit-thumbs></div>
        <div class="enq__drop occ-pics__drop" role="button" tabindex="0" data-edit-drop aria-label="Add inspiration pictures">
          <input type="file" accept="image/*" multiple hidden data-edit-file />
          <div class="enq__drop-empty"><p><span class="upload-copy--desktop">Drag pictures here, or click to browse</span><span class="upload-copy--mobile">Tap to choose pictures</span></p><small>Up to 15 MB per picture</small></div>
        </div>
        <p class="enq__drop-status occ-pics__status" data-edit-status hidden></p>
      </div>

      <p class="ecard__notice" data-reminder-notice>${safe(reminderNotice(o.occasion_date, o.recurring_yearly))}</p>
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

let calPicker = false;

// Tapping a day asks what the day is for before sending them anywhere, because
// a calendar date means two different things here: a free reminder, or a cake.
let choiceDate = null;

function openDateSheet(key) {
  const box = $('#dayChoice');
  if (!box) return;
  choiceDate = key;
  $('#choiceDate').textContent = pretty(key);

  // The four day rule is a baking lead time, so it gates ordering a cake and
  // nothing else. A date may always be saved, including today and the past.
  const canOrder = key >= earliestDate();
  const order = $('#choiceOrder');
  order.disabled = !canOrder;
  order.classList.toggle('choice--off', !canOrder);
  $('#choiceOrderNote').textContent = canOrder
    ? 'Start an enquiry for this date. I will phone you to talk it through, then send a quote.'
    : `Too soon for a cake. I need four full days to bake, so the earliest I can take is ${pretty(earliestDate())}.`;

  // Saving is always allowed, but say plainly what the reminders will do.
  $('#choiceLede').textContent = reminderOutlook(key);

  box.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => box.classList.add('is-open'));
}

// What saving this particular date actually gets them, in one sentence.
function reminderOutlook(key) {
  const days = Math.round((new Date(`${key}T00:00:00`) - new Date(`${ymd(new Date())}T00:00:00`)) / 86400000);
  if (days < 0) return 'This date has already passed. You can still save it, and for a date that repeats your reminders will start next year.';
  if (days < 4) return 'This is very close. You can still save it, and if it repeats every year your reminders will start next year.';
  if (days < 31) return 'This is under a month away, so you will get the two week and one week reminders this time, and the full run from next year.';
  return 'What would you like to do with it?';
}

function closeDayChoice() {
  const box = $('#dayChoice');
  if (!box) return;
  box.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => { box.hidden = true; }, REDUCED ? 0 : 320);
  choiceDate = null;
}

function monthPicker(year, month) {
  return `<div class="calpick">
    <div class="calpick__years">
      <button type="button" data-cal-year="${year - 1}" aria-label="Previous year">&#8249;</button>
      <b>${year}</b>
      <button type="button" data-cal-year="${year + 1}" aria-label="Next year">&#8250;</button>
    </div>
    <div class="calpick__months">${MONTHS.map((m, i) => `<button type="button" class="${i === month ? 'is-active' : ''}" data-cal-month="${i}">${m.slice(0, 3)}</button>`).join('')}</div>
    <button type="button" class="calpick__today" data-cal-today>Back to this month</button>
  </div>`;
}

// The panel beside the calendar on desktop: who they are, what is coming, and
// what the two colours of heartbeat mean.
function renderCalSide(map) {
  const side = $('#calSide');
  if (!side) return;
  const todayKey = ymd(new Date());
  const first = customer?.first_name || String(customer?.full_name || '').trim().split(/\s+/)[0] || 'there';
  const upcomingDates = occasions.filter((o) => String(o.occasion_date) >= todayKey).length;
  const openOrders = orders.filter((o) => o.status !== 'completed').length;
  const nextKey = [...map.keys()].filter((k) => k >= todayKey).sort()[0];
  const nextItem = nextKey ? (map.get(nextKey) || [])[0] : null;

  side.innerHTML = `
    <p class="page-hero__eyebrow">Your Cake Calendar</p>
    <h3 class="calside__title">Good to see you, ${safe(first)}.</h3>
    <p class="calside__body">This is where your saved dates and orders live. Add anything you would rather not forget and I will remember it for you.</p>
    <dl class="calside__stats">
      <div><dt>Cakes on the go</dt><dd>${openOrders}</dd></div>
      <div><dt>Dates saved</dt><dd>${upcomingDates}</dd></div>
    </dl>
    ${nextItem ? `<p class="calside__next" style="--accent:${accentFor(nextItem.occasion_type)}">
      <span><i class="calside__dot" aria-hidden="true"></i>Next up</span>
      <b>${safe(nextItem.title)}</b>
      <i class="calside__when">${safe(pretty(nextKey))}</i>
    </p>` : ''}
    <ul class="callegend">
      <li><i class="cal__pip cal__pip--order"></i>A cake order</li>
      <li><i class="cal__pip cal__pip--date"></i>A saved date from the Occasion Book</li>
      <li><i class="callegend__today"></i>Today</li>
    </ul>
    ${undatedOrders() ? `<p class="calside__hint">${undatedOrders()} ${undatedOrders() === 1 ? 'cake has' : 'cakes have'} no date agreed yet, so ${undatedOrders() === 1 ? 'it does' : 'they do'} not appear on the grid. You will find ${undatedOrders() === 1 ? 'it' : 'them'} under Orders.</p>` : ''}
    <p class="calside__hint">Reminders arrive a month, two weeks and a week before. Nothing is booked.</p>`;
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
    const on = map.get(key) || [];
    const kinds = [...new Set(on.map((i) => (i.type === 'Cake order' ? 'order' : 'date')))];
    const classes = ['cal__day', on.length ? 'is-marked' : '', key === todayKey ? 'is-today' : '', key === calSelected ? 'is-selected' : ''].filter(Boolean).join(' ');
    const label = on.length ? ` aria-label="${on.length} on ${day} ${MONTHS[month]}: ${on.map((i) => i.type).join(', ')}"` : '';
    const pips = kinds.length ? `<span class="cal__pips">${kinds.map((k) => `<i class="cal__pip cal__pip--${k}"></i>`).join('')}</span>` : '';
    // Only a saved date can be dragged, and only when it is the single thing on
    // that day, so there is never a question of which one moved. Orders are not
    // draggable: their date is a commitment Hazel is baking to, not a reminder.
    const dates = on.filter((i) => i.kind === 'date');
    const drag = (dates.length === 1 && on.length === 1)
      ? ` draggable="true" data-drag-date="${dates[0].id}"` : '';
    cells.push(`<button type="button" class="${classes}" data-date="${key}"${label}${drag}><span>${day}</span>${pips}</button>`);
  }

  $('#accountCalendar').innerHTML = `
    <div class="cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" data-cal-step="-1" aria-label="Previous month">&#8249;</button>
        <button type="button" class="cal__month" data-cal-picker aria-expanded="${calPicker}" aria-label="Jump to another month">${MONTHS[month]} ${year}</button>
        <button type="button" class="cal__nav" data-cal-step="1" aria-label="Next month">&#8250;</button>
        ${calPicker ? monthPicker(year, month) : ''}
      </div>
      <div class="cal__grid">${DOW.map((d) => `<span class="cal__dow">${d}</span>`).join('')}${cells.join('')}</div>
    </div>
`;
  renderCalSide(map);
}

// ---- Drag a saved date onto another day -----------------------------------
// Pointer only. HTML5 drag events never fire on touch, and rather than build a
// second touch-drag engine the Occasion Book tab keeps its Edit form, which is
// the better interaction on a phone anyway.
let draggingDateId = null;

function wireCalendarDrag() {
  const grid = $('#accountCalendar');
  if (!grid || grid.dataset.dragWired) return;
  grid.dataset.dragWired = '1';

  grid.addEventListener('dragstart', (e) => {
    const cell = e.target.closest('[data-drag-date]');
    if (!cell) return;
    draggingDateId = cell.dataset.dragDate;
    cell.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox will not start a drag unless something is written to the transfer.
    e.dataTransfer.setData('text/plain', draggingDateId);
  });

  grid.addEventListener('dragend', () => {
    draggingDateId = null;
    $$('.cal__day').forEach((c) => c.classList.remove('is-dragging', 'is-dragover'));
  });

  grid.addEventListener('dragover', (e) => {
    const cell = e.target.closest('.cal__day[data-date]');
    if (!cell || !draggingDateId) return;
    e.preventDefault(); // without this the drop never fires
    e.dataTransfer.dropEffect = 'move';
    if (!cell.classList.contains('is-dragover')) {
      $$('.cal__day.is-dragover').forEach((c) => c.classList.remove('is-dragover'));
      cell.classList.add('is-dragover');
    }
  });

  grid.addEventListener('drop', async (e) => {
    const cell = e.target.closest('.cal__day[data-date]');
    if (!cell || !draggingDateId) return;
    e.preventDefault();
    const id = draggingDateId;
    const to = cell.dataset.date;
    draggingDateId = null;
    $$('.cal__day').forEach((c) => c.classList.remove('is-dragging', 'is-dragover'));
    await moveOccasion(id, to);
  });
}

async function moveOccasion(id, to) {
  const occ = occasions.find((o) => o.id === id);
  if (!occ || occ.occasion_date === to) return;
  const from = occ.occasion_date;
  // Optimistic: the grid redraws instantly, then reverts if the write fails.
  occ.occasion_date = to;
  renderAll();
  const { error } = await supabase.from('circle_members').update({ occasion_date: to }).eq('id', id);
  if (error) {
    occ.occasion_date = from;
    renderAll();
    alert(friendlyDateError(error, to).replace(/^I cannot save/, 'I cannot move that to'));
    return;
  }
  await refreshData();
}

// An order is finished when Hazel marks it completed. Everything else is still
// live work, including an enquiry she has not quoted yet.
const isDone = (o) => o.status === 'completed' || o.status === 'cancelled';
// A cake with no agreed date cannot sit on a grid of days, so it would silently
// vanish from the calendar while still being counted as on the go.
const undatedOrders = () => orders.filter((o) => !o.occasion_date && !isDone(o)).length;

// circle_members has no column for pictures. The Occasion Book appends their
// storage paths to the end of `notes` under an "Inspiration pictures:" heading
// (see PROJECT-MEMORY: done that way so the edge function kept working without
// a redeploy). So `notes` holds two different things, and an edit box bound
// straight to it would show the customer raw storage paths and then delete them
// on save. Split on the way in, put the block back on the way out.
const PICTURE_HEADING = 'Inspiration pictures:';

// Older rows still carry their picture paths inside the notes text. Migration
// 0015 moved them to photo_paths, but the notes copy is deliberately left in
// place, so strip it before showing notes to anyone.
function splitNotes(notes) {
  const all = String(notes || '');
  const at = all.indexOf(PICTURE_HEADING);
  if (at === -1) return { text: all.trim(), pictures: '' };
  return { text: all.slice(0, at).trim(), pictures: all.slice(at).trim() };
}

const joinNotes = (text, pictures) => [String(text || '').trim(), pictures].filter(Boolean).join('\n\n') || null;

// A saved date is locked once a cake for it is Confirmed or further on. The
// database refuses the write either way (migration 0015); this is so the page
// explains it instead of showing a control that fails.
// Confirmed, Baking, Ready. Completed deliberately unlocks it again: once the
// cake is collected the record is history and tidying it harms nothing.
const LOCKED_STATUSES = ['deposit_paid', 'baking', 'ready'];
const isLocked = (o) => LOCKED_STATUSES.includes(o?.status);
const lockingOrder = (memberId) => orders.find((o) => o.circle_member_id === memberId && isLocked(o));

// Said the same way wherever a lock is explained.
const lockReason = (o) => `${statusLabel(o.status) === 'Deposit paid' ? 'This cake is confirmed' : `This cake is ${statusLabel(o.status).toLowerCase()}`}, so it cannot be changed here for now. Reply to any email from me and I will sort it out. It opens up again once the cake is collected.`;

const MAX_PICTURES = 6;

// An order is a journey through the kitchen, which is what makes it different
// from a saved date. The Orders tab used the same card as the Occasion Book, so
// the two read as the same kind of thing. This rail is the difference.
// These are the admin order board's columns, in its order, so Hazel and the
// customer are looking at the same six steps. deposit_paid is its own stage
// called Confirmed, not part of Quoted.
const STAGES = ['Enquiry', 'Quoted', 'Confirmed', 'Baking', 'Ready', 'Completed'];
const STAGE_AT = { enquiry: 0, quoted: 1, deposit_paid: 2, baking: 3, ready: 4, completed: 5 };

function stageRail(o) {
  if (o.status === 'cancelled') return '<p class="ocard__cancelled">This order was cancelled.</p>';
  const at = STAGE_AT[o.status] ?? 0;
  // Dots only. The stage name is carried once, underneath, rather than
  // repeated as six labels across the row.
  return `<div class="ostage">
    <ol class="ostage__dots" aria-label="Step ${at + 1} of ${STAGES.length}, ${safe(STAGES[at])}">
      ${STAGES.map((s, i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-now' : ''}" title="${safe(s)}"></li>`).join('')}
    </ol>
    <p class="ostage__now">${safe(STAGES[at])} <em>step ${at + 1} of ${STAGES.length}</em></p>
  </div>`;
}
const owedOn = (o) => Math.max(Number(o.total_amount_zar || 0) - Number(o.amount_paid_zar || 0), 0);
const rand = (n) => `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- Overview -------------------------------------------------------------
// The one screen that answers "is anything happening?" without reading a list.
function renderOverview() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = timeline().filter((i) => i.date >= today);
  const next = upcoming[0];

  // Each occasion carries a quiet accent of its own, so a wedding does not look
  // like a birthday. Used as a hairline and a dot only, never as a fill.
  const accent = accentFor(next && next.occasion_type);
  $('#overviewNext').innerHTML = next
    ? `<article class="ovnext" style="--accent:${accent}">
         ${dateBlock(next.date)}
         <div class="ovnext__body">
           <span class="ovnext__eyebrow"><i class="ovnext__dot" aria-hidden="true"></i>Next up${daysAway(next.date)}</span>
           <h3>${safe(next.title)}</h3>
           <p>${safe(next.detail)}</p>
         </div>
       </article>`
    : `<article class="ovnext ovnext--empty">
         <div class="ovnext__body">
           <span class="ovnext__eyebrow">Nothing coming up</span>
           <h3>Your diary is clear</h3>
           <p>Save a birthday or an anniversary and I will remind you in good time, free, with no cake booked.</p>
         </div>
       </article>`;

  const live = orders.filter((o) => !isDone(o));
  const owing = orders.reduce((sum, o) => sum + owedOn(o), 0);
  const cards = [
    { n: upcoming.length, label: upcoming.length === 1 ? 'Date coming up' : 'Dates coming up', tab: 'calendar' },
    { n: live.length, label: live.length === 1 ? 'Cake in the kitchen' : 'Cakes in the kitchen', tab: 'orders' },
    { n: owing > 0 ? rand(owing) : 'Nothing due', label: owing > 0 ? 'Balance on your cakes' : 'Your balance', tab: 'payments' },
    { n: occasions.length, label: occasions.length === 1 ? 'Date saved' : 'Dates saved', tab: 'dates' },
  ];
  $('#overviewStats').innerHTML = cards.map((c) => `
    <button class="ovcard" type="button" data-goto-tab="${c.tab}">
      <b>${safe(c.n)}</b><span>${safe(c.label)}</span>
    </button>`).join('');
}

// "in 3 days" reads better than a date the reader has to subtract from today.
function daysAway(date) {
  const days = Math.round((new Date(date + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) / 86400000);
  if (days <= 0) return ', today';
  if (days === 1) return ', tomorrow';
  if (days < 31) return `, in ${days} days`;
  return '';
}

// ---- Payments -------------------------------------------------------------
function renderPayments() {
  const quoted = orders.filter((o) => o.total_amount_zar != null);
  const owing = orders.reduce((sum, o) => sum + owedOn(o), 0);
  const awaiting = orders.filter((o) => o.total_amount_zar == null && !isDone(o)).length;

  // Nothing is charged through this site and no one is chased for money here.
  // Payment is agreed on the phone when we talk the cake through, so this is a
  // record of where things stand, not a demand.
  $('#paymentsSummary').innerHTML = `
    <div class="paytotal ${owing > 0 ? 'paytotal--due' : ''}">
      <span>${owing > 0 ? 'Your balance across all your cakes' : 'Your balance'}</span>
      <b>${owing > 0 ? rand(owing) : 'Nothing due'}</b>
      <em>${awaiting
        ? `${awaiting} ${awaiting === 1 ? 'cake is' : 'cakes are'} still waiting on a quote from me. I will phone you to talk it through before anything is owed.`
        : 'We agree payment on the phone when we talk your cake through. Nothing is ever charged through this site.'}</em>
    </div>`;

  $('#paymentsList').innerHTML = quoted.length ? quoted.map((o) => {
    const title = orderTitle(o);
    const total = Number(o.total_amount_zar || 0);
    const paid = Number(o.amount_paid_zar || 0);
    const owed = owedOn(o);
    const pct = total ? Math.min(100, (paid / total) * 100).toFixed(0) : 0;
    return `<article class="ecard ecard--order">
      ${dateBlock(o.occasion_date)}
      <div class="ecard__body">
        <h3>${safe(title)}</h3>
        <p class="chips"><em class="chip chip--pay-${safe(o.payment_status || 'unpaid')}">${safe(paymentLabel(o.payment_status))}</em></p>
        <p class="account-card__note">${rand(paid)} paid of ${rand(total)}${owed > 0 ? `, ${rand(owed)} left on your balance` : '. Settled, thank you'}</p>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </div>
      <div class="ecard__actions">
        ${o.invoice_path ? `<button data-file="invoice" data-order="${o.id}">Invoice</button>` : ''}
        ${o.receipt_path ? `<button data-file="receipt" data-order="${o.id}">Receipt</button>` : ''}
      </div>
    </article>`;
  }).join('') : empty('Nothing to pay yet. Once I have quoted a cake it will appear here with its invoice.');
}

// ---- Sent log -------------------------------------------------------------
// reminder_type is a template name. Customers should never see a template name.
const SENT_LABELS = {
  reminder_1_month: 'Reminder, one month before',
  reminder_2_weeks: 'Reminder, two weeks before',
  reminder_1_week: 'Reminder, one week before',
  enquiry_received: 'Enquiry received',
  enquiry_followup: 'Follow up on your enquiry',
  quote_ready: 'Your quote',
  invoice_delivery: 'Your invoice',
  order_confirmed: 'Order confirmed',
  order_ready: 'Your cake is ready',
  memory_card: 'A memory of your cake',
  circle_followup: 'Occasion Book follow up',
  welcome_occasion_book: 'Welcome to the Occasion Book',
  account_created: 'Account created',
};
const sentLabel = (t) => SENT_LABELS[t] || String(t || 'Message').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const SENT_PAGE = 8;

function renderSentLog() {
  const box = $('#sentLog');
  const more = $('#sentLogMore');
  if (!box) return;
  if (!sentLog.length) {
    box.innerHTML = empty('Nothing sent yet. Once I email you a reminder or an invoice it will be listed here.');
    if (more) more.hidden = true;
    return;
  }
  const shown = sentLogAll ? sentLog : sentLog.slice(0, SENT_PAGE);
  box.innerHTML = shown.map((s) => {
    // A failed or skipped send is the whole point of showing this list, so it
    // is stated plainly rather than quietly left out.
    const state = s.status === 'sent' ? '' : s.status === 'skipped'
      ? '<em class="chip chip--muted">Not sent, you had opted out</em>'
      : '<em class="chip chip--fail">Failed to send</em>';
    return `<div class="sentrow">
      <div class="sentrow__main">
        <strong>${safe(sentLabel(s.reminder_type))}</strong>
        <span>${safe(sentWhen(s.sent_at))} &middot; ${safe(s.channel === 'whatsapp' ? 'WhatsApp' : 'Email')}</span>
      </div>
      ${state}
    </div>`;
  }).join('');
  if (more) {
    more.hidden = sentLog.length <= SENT_PAGE;
    more.textContent = sentLogAll ? 'Show fewer' : `Show all ${sentLog.length}`;
  }
}

const sentWhen = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  : 'Date unknown');

const orderTitle = (o) => (o.circle_member
  ? occasionTitle(o.circle_member)
  : (o.cake_description || 'Cake order'));

function renderAll() {
  // Each panel renders on its own. They used to run as one straight sequence,
  // so a throw in any of them left every list after it blank with no message,
  // which is how the Occasion Book tab came up empty while the calendar showed
  // the very same occasion. §4: one error taking out everything after it.
  const part = (name, fn) => { try { fn(); } catch (e) { console.error(`render ${name} failed`, e); } };
  part('calendar', renderCalendar);
  part('calendarDrag', wireCalendarDrag);
  part('overview', renderOverview);
  part('payments', renderPayments);
  part('sentLog', renderSentLog);

  const orderCard = (o) => {
    const total = Number(o.total_amount_zar || 0);
    const paid = Number(o.amount_paid_zar || 0);
    const owing = owedOn(o);
    const pct = total ? Math.min(100, (paid / total) * 100).toFixed(0) : 0;
    const money = o.total_amount_zar == null
      ? '<p class="ocard__money-note">I am still working out your quote. I will phone you to talk it through.</p>'
      : `<div class="ocard__money">
           <p class="ocard__money-note">${rand(paid)} paid of ${rand(total)}${owing > 0 ? `, ${rand(owing)} left on your balance` : '. Settled, thank you'}</p>
           <span class="bar"><i style="width:${pct}%"></i></span>
         </div>`;
    return `<article class="ocard">
      <header class="ocard__top">
        <div class="ocard__head">
          <p class="ocard__for">${o.occasion_date ? `For ${safe(pretty(o.occasion_date))}` : 'Date still to agree'}</p>
          <h3>${safe(orderTitle(o))}</h3>
        </div>
        <em class="ocard__status chip--${safe(o.status || 'enquiry')}">${safe(statusLabel(o.status))}</em>
      </header>
      ${stageRail(o)}
      ${money}
      <div class="ocard__acts">
        <button type="button" data-open-order="${o.id}" aria-expanded="${openOrder === o.id}">${openOrder === o.id ? 'Hide details' : 'View details'}</button>
        <button type="button" data-reorder="${o.id}">Order this again</button>
        ${o.invoice_path ? `<button type="button" data-file="invoice" data-order="${o.id}">Invoice</button>` : ''}
        ${o.receipt_path ? `<button type="button" data-file="receipt" data-order="${o.id}">Receipt</button>` : ''}
      </div>
      ${openOrder === o.id ? orderDetail(o) : ''}
      ${reorderFor === o.id ? reorderForm(o) : ''}
    </article>`;
  };

  // Current and history as two tabs rather than two stacked lists, so a long
  // history never buries the cake that is actually being made.
  part('orders', () => {
    const current = orders.filter((o) => !isDone(o));
    const history = orders.filter(isDone);
    const showing = orderTab === 'history' ? history : current;
    $('#currentCount').textContent = current.length || '';
    $('#historyCount').textContent = history.length || '';
    $('#accountOrders').innerHTML = showing.length ? showing.map(orderCard).join('')
      : empty(orderTab === 'history'
        ? 'No finished cakes yet. Once a cake is collected it moves here, and you can order it again in one tap.'
        : 'Nothing in the kitchen right now. When you send an enquiry it will appear here, and you can follow it from quote to collection.');
  });

  part('dates', renderDates);
}

// A recurring date that has already passed this year comes round again next
// year, and that is the date worth showing. The stored row is not rolled
// forward until 1 January by daily-occasion-checker, so this is display only
// and never written back.
function nextOccurrence(o) {
  const d = o.occasion_date;
  if (!d) return null;
  const today = ymd(new Date());
  if (!o.recurring_yearly || d >= today) return d;
  const at = new Date(`${d}T00:00:00`);
  while (ymd(at) < today) at.setFullYear(at.getFullYear() + 1);
  return ymd(at);
}

// "in 6 days" is the thing a customer actually wants to know.
function countdown(date) {
  if (!date) return '';
  const days = Math.round((new Date(`${date}T00:00:00`) - new Date(`${ymd(new Date())}T00:00:00`)) / 86400000);
  if (days < 0) return 'Passed';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 31) return `In ${days} days`;
  if (days < 60) return 'Next month';
  const months = Math.round(days / 30);
  return months < 12 ? `In ${months} months` : 'Next year';
}

function occasionCard({ o, when, past }) {
  if (editingDate === o.id) return dateEditor(o);
  const locked = lockingOrder(o.id);
  const soon = !past && when && Math.round((new Date(`${when}T00:00:00`) - new Date(`${ymd(new Date())}T00:00:00`)) / 86400000) <= 30;
  return `
  <article class="occ-card${past ? ' occ-card--past' : ''}${soon ? ' occ-card--soon' : ''}">
    <div class="occ-card__when">
      <b>${when ? Number(when.slice(8, 10)) : '&middot;'}</b>
      <span>${when ? MONTHS[Number(when.slice(5, 7)) - 1].slice(0, 3) : 'TBC'}</span>
      <i>${when ? when.slice(0, 4) : ''}</i>
    </div>
    <div class="occ-card__body">
      <p class="occ-card__count">${safe(countdown(when))}</p>
      <h3>${safe(personLabel(o))}</h3>
      <p class="occ-card__what">${safe(o.occasion_type)} &middot; ${o.recurring_yearly ? 'every year' : 'one time'}</p>
      <p class="occ-card__note">${o.recurring_yearly
        ? 'A month, two weeks and a week before, every year.'
        : 'One reminder in good time before the day.'}</p>
    </div>
    <div class="occ-card__acts">
      ${locked
        ? `<span class="occ-card__locked">${safe(lockReason(locked))}</span>`
        : `<button type="button" data-edit-date="${o.id}">Edit</button>
           <button type="button" data-delete-date="${o.id}">Remove</button>`}
    </div>
  </article>`;
}

// ---- Editing pictures on a saved date --------------------------------------
// Held in memory while the form is open and written to photo_paths on save, so
// Cancel really cancels. A removed picture is unlinked, not deleted from
// storage, because a misclick should not destroy the only copy they have.
let editPhotos = [];
let editUploading = 0;

async function signedThumb(path) {
  const { data } = await supabase.functions.invoke('customer-file', { body: { kind: 'inspiration', path } });
  return data?.url || '';
}

async function paintEditThumbs() {
  const box = $('[data-edit-thumbs]');
  if (!box) return;
  // Starts in the loading state with no src at all. An <img> with an empty src
  // renders the browser's broken-image icon and its alt text, which is what
  // made a perfectly good upload look like a failure.
  box.innerHTML = editPhotos.map((p, i) => `
    <div class="enq__thumb is-loading" data-thumb-index="${i}">
      <img alt="" />
      <span class="enq__thumb-spin" aria-hidden="true"></span>
      <button type="button" class="enq__thumb-x" data-remove-photo="${i}" aria-label="Remove picture ${i + 1}">&#215;</button>
    </div>`).join('');
  const drop = $('[data-edit-drop]');
  if (drop) drop.hidden = editPhotos.length >= MAX_PICTURES;
  // Signed URLs are short lived, so they are fetched each time rather than kept.
  await Promise.all(editPhotos.map(async (p, i) => {
    const url = await signedThumb(p);
    const thumb = $(`[data-thumb-index="${i}"]`, box);
    const img = thumb && $('img', thumb);
    if (!img) return;
    if (!url) { thumb.classList.remove('is-loading'); thumb.classList.add('is-missing'); return; }
    img.alt = `Inspiration picture ${i + 1}`;
    img.addEventListener('load', () => thumb.classList.remove('is-loading'), { once: true });
    img.addEventListener('error', () => { thumb.classList.remove('is-loading'); thumb.classList.add('is-missing'); }, { once: true });
    img.src = url;
  }));
}

async function uploadEditPhoto(file) {
  const status = $('[data-edit-status]');
  if (editPhotos.length >= MAX_PICTURES) {
    if (status) { status.hidden = false; status.textContent = `That is the most I can take, ${MAX_PICTURES} pictures.`; }
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    if (status) { status.hidden = false; status.textContent = `${file.name} is larger than 15 MB.`; }
    return;
  }
  editUploading += 1;
  if (status) { status.hidden = false; status.textContent = 'Uploading...'; }
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const path = `${customer.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('inspiration-photos').upload(path, file, { upsert: false });
  editUploading -= 1;
  if (error) {
    if (status) status.textContent = 'That picture would not upload. Please try again.';
    return;
  }
  if (status) { status.hidden = true; status.textContent = ''; }
  editPhotos.push(path);
  await paintEditThumbs();
}

function renderDates() {
  const box = $('#accountDates');
  if (!box) return;
  if (!occasions.length) {
    box.innerHTML = empty('No dates saved yet. Add the birthdays and anniversaries you never want to miss and I will remind you, free, with no cake booked.');
    return;
  }
  const today = ymd(new Date());
  const rows = occasions.map((o) => ({
    o,
    when: nextOccurrence(o),
    // Only a one-time date can truly be in the past. A birthday never is.
    past: !o.recurring_yearly && !!o.occasion_date && o.occasion_date < today,
  }));
  const upcoming = rows.filter((r) => !r.past).sort((a, b) => String(a.when).localeCompare(String(b.when)));
  const past = rows.filter((r) => r.past).sort((a, b) => String(b.when).localeCompare(String(a.when)));

  // Upcoming first. The list used to run in raw date order, so dates that had
  // already gone sat at the top and the next one worth knowing about was
  // buried underneath them.
  box.innerHTML = [
    upcoming.length ? `<div class="occgrid">${upcoming.map(occasionCard).join('')}</div>` : '',
    past.length ? `<div class="subhead subhead--spaced"><h3>Already been and gone</h3><span>${past.length}</span></div>
      <div class="occgrid">${past.map(occasionCard).join('')}</div>` : '',
  ].filter(Boolean).join('');
  window.hclEnhanceSelects?.(box);
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

// Phone calls are part of the service, not a choice, so they are not on this
// list. Migration 0016 defaults the column true and revokes the customer's
// grant to change it.
const CONSENTS = ['email_consent', 'whatsapp_consent'];

function fillProfile() {
  const form = $('#accountProfile');
  ['first_name','last_name','whatsapp_number','address_line_1','address_line_2','suburb','city','province','postal_code'].forEach((name) => { form.elements[name].value = customer[name] || ''; });
  const prefs = $('#accountPrefs');
  if (prefs) CONSENTS.forEach((name) => { prefs.elements[name].checked = !!customer[name]; });
  const emailField = $('#emailChangeForm')?.elements.new_email;
  if (emailField) emailField.value = customer.email || '';
  const prefsEmail = $('#prefsEmail');
  if (prefsEmail) prefsEmail.textContent = customer.email || 'your email address';
  syncPrefsSummary();
}

// Says in one line what they are signed up to, so the tab answers its own
// question before they read a single checkbox.
function syncPrefsSummary() {
  const form = $('#accountPrefs');
  if (!form) return;
  const on = [
    form.elements.email_consent?.checked && 'email',
    form.elements.whatsapp_consent?.checked && 'WhatsApp',
  ].filter(Boolean);
  const agreed = $('#prefsAgreed');
  if (agreed) {
    agreed.textContent = on.length
      ? `Right now your reminders come by ${listSentence(on)}. Untick a box and I will stop that one.`
      : 'You have not chosen any reminders, so I will only email you about a cake you have actually ordered.';
  }
  // WhatsApp and a phone call both need a number, and there is no point saving a
  // consent I cannot act on.
  const needs = form.elements.whatsapp_consent?.checked
    && !String(customer.whatsapp_number || '').trim();
  const note = $('#prefsNeedsNumber');
  if (note) note.hidden = !needs;
}

const listSentence = (items) => (items.length < 2
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

async function savePrefs(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const status = $('#prefsStatus');
  const payload = {};
  CONSENTS.forEach((n) => { payload[n] = form.elements[n].checked; });
  // POPIA: record when WhatsApp consent was actually given, not just that it is on.
  if (payload.whatsapp_consent && !customer.whatsapp_consent) payload.whatsapp_consent_date = new Date().toISOString();
  if (!payload.whatsapp_consent) payload.whatsapp_consent_date = null;
  status.textContent = 'Saving...';
  const { data, error } = await supabase.from('customers').update(payload).eq('id', customer.id).select().single();
  if (error) { status.textContent = error.message; return; }
  customer = data;
  status.textContent = 'Saved. This is how I will contact you from now on.';
  syncPrefsSummary();
}

async function saveProfile(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const phone = String(f.get('whatsapp_number') || '').trim();
  if (phone && !/^(?:\+27|0)[6-8]\d{8}$/.test(phone.replace(/\s/g, ''))) { $('#profileStatus').textContent = 'Please enter a valid South African phone number.'; return; }
  const payload = Object.fromEntries(['first_name','last_name','whatsapp_number','address_line_1','address_line_2','suburb','city','province','postal_code'].map((n) => [n, String(f.get(n) || '').trim() || null]));
  payload.province = matchProvince(payload.province); // the column only accepts the nine
  // Consents live on the Notifications tab now and are saved from there.
  const { data, error } = await supabase.from('customers').update(payload).eq('id', customer.id).select().single();
  $('#profileStatus').textContent = error ? error.message : 'Your details are saved.';
  if (data) {
    customer = data;
    setNavName(customer.first_name || customer.full_name);
    $('#accountName').textContent = customer.first_name || String(customer.full_name || '').split(' ')[0] || 'there';
    syncPrefsSummary(); // a number saved here clears the warning on Notifications
  }
}

const securityStatus = () => $('#securityStatus');

// Re-reads the customer's dates and orders without throwing away the page.
async function refreshData() {
  const [datesRes, ordersRes, sentRes] = await Promise.all([
    supabase.from('circle_members').select('*').eq('customer_id', customer.id).order('occasion_date'),
    supabase.from('orders').select(ORDER_FIELDS).eq('customer_id', customer.id).order('occasion_date'),
    // reminder_log has held every send since the start, and customers already
    // have RLS read access to their own rows, so the sent log needs no new table.
    supabase.from('reminder_log').select('id,reminder_type,channel,status,sent_at,error_message')
      .eq('customer_id', customer.id).order('sent_at', { ascending: false }).limit(100),
  ]);
  sentLog = sentRes.data || sentLog;
  occasions = datesRes.data || occasions;
  orders = ordersRes.data || orders;
  renderAll();
}

async function sendReorder(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const id = form.dataset.reorderForm;
  const date = String(new FormData(form).get('requested_date') || '');
  const note = String(new FormData(form).get('note') || '').trim();
  if (!date) return;
  if (date < earliestDate()) { alert(`The earliest I can take is ${pretty(earliestDate())}, so there is time to bake.`); return; }
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  const { error } = await supabase.rpc('request_reorder', { source_order_id: id, requested_date: date });
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send this enquiry'; }
    alert(error.message);
    return;
  }
  if (note) {
    // Keep the customer's change request with the occasion so Hazel sees it.
    const src = orders.find((o) => o.id === id);
    if (src?.circle_member) {
      await supabase.from('circle_members').update({ notes: `Reorder request: ${note}` }).eq('person_name', src.circle_member.person_name).eq('customer_id', customer.id);
    }
  }
  reorderFor = null;
  await refreshData();
  alert('Your enquiry is with Hazel. She will confirm and quote by email.');
}

async function saveDate(e) {
  e.preventDefault();
  const id = e.currentTarget.dataset.saveDate;
  const f = new FormData(e.currentTarget);
  if (editUploading > 0) { alert('Please wait for your pictures to finish uploading.'); return; }
  const repeats = e.currentTarget.elements.recurring_yearly.checked;
  const patch = {
    person_name: [String(f.get('first_name') || '').trim(), String(f.get('last_name') || '').trim()].filter(Boolean).join(' '),
    relationship_to_customer: String(f.get('relationship_to_customer') || '').trim() || null,
    occasion_type: String(f.get('occasion_type') || '').trim(),
    occasion_date: String(f.get('occasion_date') || ''),
    // Keep the legacy picture block in notes for older rows. Pictures
    // themselves now live in photo_paths.
    notes: joinNotes(f.get('notes'), splitNotes(occasions.find((x) => x.id === id)?.notes).pictures),
    photo_paths: editPhotos.slice(),
    recurring_yearly: repeats,
    // Kept in step, or daily-occasion-checker treats the row as neither.
    is_one_time: !repeats,
  };
  // An Occasion Book date is only a reminder, so any date is allowed. The four
  // day rule belongs to cake orders, not to remembering a birthday.
  if (!patch.person_name || !patch.occasion_date) return;
  const { error } = await supabase.from('circle_members').update(patch).eq('id', id);
  if (error) { alert(error.message); return; }
  editingDate = null;
  editPhotos = [];
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

// True when the account was created with an email and password. A Google-only
// account has no password to confirm, so it is setting one for the first time
// rather than changing one, and the wording and the fields both have to follow.
let hasPassword = true;
// The address Supabase actually authenticates against. Not read from the
// customers row, which a completed email change does not currently write back.
let authEmail = '';

async function setUpSecurity(user) {
  // getSession reads local storage and does not always carry identities. Without
  // them a Google-only customer would be asked for a password they have never
  // set, so it is worth the round trip to ask the server.
  if (!user?.identities) {
    const { data } = await supabase.auth.getUser();
    user = data?.user || user;
  }
  authEmail = user?.email || authEmail;
  renderSessionInfo(user);
  const providers = (user?.identities || []).map((i) => i.provider);
  hasPassword = providers.length === 0 || providers.includes('email');
  const social = providers.filter((p) => p !== 'email');

  const method = $('#signInMethod');
  if (method) {
    method.textContent = social.length
      ? `You signed in with ${social.map(titleCase).join(' and ')}. Changing your email address here changes the address I use to reach you.`
      : '';
  }
  const field = $('#currentPasswordField');
  const current = $('#pwCurrent');
  if (field) field.hidden = hasPassword ? false : true;
  if (current) current.disabled = !hasPassword;
  const title = $('#passwordTitle');
  const hint = $('#passwordHint');
  const submit = $('#passwordSubmit');
  if (hasPassword) {
    if (title) title.textContent = 'Password';
    if (hint) hint.textContent = 'Choose something you do not use anywhere else. Eight characters at the very least.';
    if (submit) submit.textContent = 'Update password';
  } else {
    if (title) title.textContent = 'Add a password';
    if (hint) hint.textContent = 'You sign in with Google at the moment. Set a password and you will be able to sign in with your email address as well, which is useful on a device where you are not signed in to Google.';
    if (submit) submit.textContent = 'Set password';
  }
}

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Supabase gives no API for listing a user's sessions, so this states only what
// is actually knowable rather than inventing a device list. Being honest about
// the limit is better than a plausible-looking table that is not real.
function renderSessionInfo(user) {
  const box = $('#sessionInfo');
  if (!box) return;
  const stamp = (iso) => (iso
    ? new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Not recorded');
  const providers = (user?.identities || []).map((i) => titleCase(i.provider === 'email' ? 'email and password' : i.provider));
  const rows = [
    ['This device', 'Signed in now'],
    ['Last sign in', stamp(user?.last_sign_in_at)],
    ['Account created', stamp(user?.created_at)],
    ['Sign in methods', providers.length ? providers.join(', ') : 'Email and password'],
  ];
  box.innerHTML = rows.map(([k, v]) => `<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join('');
}

async function signOutEverywhere() {
  const status = securityStatus();
  status.textContent = 'Ending every session...';
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) { status.textContent = friendly(error); return; }
  setNavName('');
  forgetMe();
  location.reload();
}

// Deleting is destructive and irreversible, so it is deliberately two steps and
// needs the word typed out. No modal: a modal invites a reflexive click.
function startDelete() {
  $('#deleteAccountForm').hidden = false;
  $('#deleteAccountStart').hidden = true;
  $('#deleteAccountForm').elements.confirm.focus();
}

function cancelDelete() {
  const form = $('#deleteAccountForm');
  form.hidden = true;
  form.reset();
  $('#deleteStatus').textContent = '';
  $('#deleteAccountStart').hidden = false;
}

async function deleteAccount(e) {
  e.preventDefault();
  const status = $('#deleteStatus');
  const typed = String(new FormData(e.currentTarget).get('confirm') || '').trim();
  if (typed.toUpperCase() !== 'DELETE') { status.textContent = 'Please type DELETE to confirm.'; return; }
  status.textContent = 'Deleting your account...';
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error || !data?.deleted) {
    status.textContent = 'I could not delete your account just now. Please email hello@hazelscakelounge.co.za and I will do it by hand.';
    return;
  }
  await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
  setNavName('');
  try { localStorage.removeItem('hcl.firstName'); } catch { /* private mode */ }
  forgetMe();
  // Replace the page content only, never document.body. The body holds the
  // custom spatula cursor element, and the site sets cursor:none on desktop, so
  // wiping it would leave the visitor with no pointer at all.
  const main = $('main');
  if (main) {
    main.innerHTML = '<section class="account-gone"><h1>Your account is deleted</h1>'
      + '<p>Your details and your saved dates are gone. Thank you for letting me bake for you.</p>'
      + '<p><a href="/">Back to the home page</a></p></section>';
  } else {
    location.href = '/';
  }
}

// Four bands, judged on length first because length is what actually matters,
// then on variety. Deliberately simple: it is a nudge, not a gate.
function passwordScore(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) score += 1;
  if (pw.length < 8) score = Math.min(score, 1);
  return Math.min(score, 4);
}

const SCORE_WORDS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function syncPasswordMeter() {
  const input = $('#pwNew');
  const meter = $('#pwMeter');
  if (!input || !meter) return;
  const value = input.value;
  meter.hidden = !value;
  const score = passwordScore(value);
  meter.dataset.score = String(score);
  $('#pwWord').textContent = SCORE_WORDS[score] || '';
}

async function changePassword(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const f = new FormData(form);
  const password = String(f.get('password') || '');
  const currentPassword = String(f.get('current_password') || '');
  if (hasPassword && !currentPassword) { securityStatus().textContent = 'Please enter your current password first.'; return; }
  if (password.length < 8) { securityStatus().textContent = 'Please use at least 8 characters.'; return; }
  if (password !== String(f.get('confirm_password') || '')) { securityStatus().textContent = 'Those two passwords do not match.'; return; }
  if (hasPassword && password === currentPassword) { securityStatus().textContent = 'That is already your password. Please choose a different one.'; return; }

  // Supabase will change a password on the strength of the session alone. That
  // means an unattended, unlocked browser is enough to lock the owner out, so
  // the current password is checked first by signing in with it. The sign in
  // returns a session for the same user, so nothing is disturbed if it passes.
  if (hasPassword) {
    securityStatus().textContent = 'Checking your current password...';
    const { error: wrong } = await supabase.auth.signInWithPassword({ email: authEmail, password: currentPassword });
    if (wrong) { securityStatus().textContent = 'That is not your current password. Please try again.'; return; }
  }

  securityStatus().textContent = 'Saving your new password...';
  const { error } = await supabase.auth.updateUser({ password });
  if (error) { securityStatus().textContent = friendly(error); return; }
  const wasChange = hasPassword; // setUpSecurity below flips this once one exists
  form.reset();
  syncPasswordMeter();
  const { data } = await supabase.auth.getUser();
  if (data?.user) setUpSecurity(data.user);
  securityStatus().textContent = wasChange
    ? 'Your password is updated. Use it next time you sign in.'
    : 'Your password is set. You can now sign in with your email address as well as with Google.';
}

async function accountAction(e) {
  const open = e.target.closest('[data-open-order]');
  if (open) { openOrder = openOrder === open.dataset.openOrder ? null : open.dataset.openOrder; renderAll(); return; }
  const reorder = e.target.closest('[data-reorder]');
  if (reorder) { reorderFor = reorderFor === reorder.dataset.reorder ? null : reorder.dataset.reorder; renderAll(); return; }
  if (e.target.closest('[data-cancel-reorder]')) { reorderFor = null; renderAll(); return; }
  const edit = e.target.closest('[data-edit-date]');
  if (edit) {
    editingDate = edit.dataset.editDate;
    // Work on a copy, so Cancel really cancels.
    editPhotos = (occasions.find((o) => o.id === editingDate)?.photo_paths || []).slice();
    renderAll();
    paintEditThumbs();
    return;
  }
  const cancel = e.target.closest('[data-cancel-date]');
  if (cancel) { editingDate = null; editPhotos = []; renderAll(); return; }
  const rmPhoto = e.target.closest('[data-remove-photo]');
  if (rmPhoto) {
    // Unlinked, not deleted from storage. A misclick should never destroy the
    // only copy of a picture they have.
    editPhotos.splice(Number(rmPhoto.dataset.removePhoto), 1);
    paintEditThumbs();
    return;
  }
  if (e.target.closest('[data-edit-drop]')) { $('[data-edit-file]')?.click(); return; }
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

function showAccountTab(name) {
  const button = $(`[data-account-tab="${name}"]`);
  if (!button) return;
  $$('[data-account-tab]').forEach((b) => b.classList.toggle('is-active', b === button));
  $$('[data-account-panel]').forEach((p) => p.classList.toggle('is-active', p.dataset.accountPanel === name));
  button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  moveTabInk();
}

$$('[data-account-tab]').forEach((button) => button.addEventListener('click', () => showAccountTab(button.dataset.accountTab)));
$$('[data-order-tab]').forEach((button) => button.addEventListener('click', () => {
  orderTab = button.dataset.orderTab;
  $$('[data-order-tab]').forEach((b) => b.classList.toggle('is-active', b === button));
  openOrder = null; reorderFor = null; // a card open in one tab should not follow you
  renderAll();
}));
// "Add one under Your details" and anything else that sends them to another tab.
document.addEventListener('click', (e) => {
  const jump = e.target.closest('[data-goto-tab]');
  if (jump) showAccountTab(jump.dataset.gotoTab);
});
addEventListener('resize', moveTabInk);
$('#googleSignIn').addEventListener('click', () => signInWithProvider('google'));
$$('[data-auth-tab]').forEach((b) => b.addEventListener('click', () => {
  clearRecoveryState();
  showPanel(b.dataset.authTab);
  authStatus.textContent = '';
}));
$('#signUpNext').addEventListener('click', nextSignUpStep);
$('#signUpNext2').addEventListener('click', nextSignUpStep2);
$('#signUpBack').addEventListener('click', () => { authStatus.textContent = ''; signUpStep(1); });
$('#signUpBack2').addEventListener('click', () => { authStatus.textContent = ''; signUpStep(2); });
$('#signInForm').addEventListener('submit', signIn);
$('#signUpForm').addEventListener('submit', createAccount);
$('#otpForm').addEventListener('submit', confirmEmail);
$('#newPasswordForm').addEventListener('submit', setNewPassword);
$('#forgotPassword').addEventListener('click', forgotPassword);
$('#resendCode').addEventListener('click', resendCode);
$('#accountProfile').addEventListener('submit', saveProfile);
$('#accountPrefs').addEventListener('submit', savePrefs);
$('#accountPrefs').addEventListener('change', syncPrefsSummary);
$('#pwNew').addEventListener('input', syncPasswordMeter);
// Show/hide, one handler for all three password fields.
$$('.pwfield__eye').forEach((eye) => eye.addEventListener('click', () => {
  const input = document.getElementById(eye.dataset.reveal);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  eye.textContent = show ? 'Hide' : 'Show';
  eye.setAttribute('aria-pressed', String(show));
}));
// Save the date: the focused save-date page, with the day already filled in.
$('#choiceSave').addEventListener('click', () => {
  if (!choiceDate) return;
  location.href = `save-date.html?date=${encodeURIComponent(choiceDate)}`;
});
// Order a cake: the enquiry overlay, opened in place with the date prefilled.
// main.js listens for [data-enquire] and reads the prefill off the dataset.
$('#choiceOrder').addEventListener('click', (e) => {
  if (!choiceDate || e.currentTarget.disabled) return;
  const when = choiceDate;
  closeDayChoice();
  const t = document.createElement('button');
  t.setAttribute('data-enquire', '');
  t.dataset.occasionDate = when;
  t.style.display = 'none';
  document.body.appendChild(t);
  t.click();
  setTimeout(() => t.remove(), 0);
});
$('#dayChoice').addEventListener('click', (e) => {
  if (e.target.closest('[data-choice-close]') || e.target === e.currentTarget) closeDayChoice();
});
$('#sentLogMore').addEventListener('click', () => { sentLogAll = !sentLogAll; renderSentLog(); });
$('#signOutEverywhere').addEventListener('click', signOutEverywhere);
$('#deleteAccountStart').addEventListener('click', startDelete);
$('#deleteAccountCancel').addEventListener('click', cancelDelete);
$('#deleteAccountForm').addEventListener('submit', deleteAccount);
$('#emailChangeForm').addEventListener('submit', changeEmail);
$('#emailOtpForm').addEventListener('submit', confirmEmailChange);
$('#passwordChangeForm').addEventListener('submit', changePassword);
// Bound to the container, so it survives every re-render of the grid.
$('#accountCalendar').addEventListener('click', (e) => {
  const step = e.target.closest('[data-cal-step]');
  if (step) {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + Number(step.dataset.calStep), 1);
    calPicker = false;
    renderCalendar();
    return;
  }
  if (e.target.closest('[data-cal-picker]')) { calPicker = !calPicker; renderCalendar(); return; }
  const yr = e.target.closest('[data-cal-year]');
  if (yr) { calCursor = new Date(Number(yr.dataset.calYear), calCursor.getMonth(), 1); renderCalendar(); return; }
  const mo = e.target.closest('[data-cal-month]');
  if (mo) { calCursor = new Date(calCursor.getFullYear(), Number(mo.dataset.calMonth), 1); calPicker = false; renderCalendar(); return; }
  if (e.target.closest('[data-cal-today]')) {
    const now = new Date();
    calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    calPicker = false; calSelected = null;
    renderCalendar();
    return;
  }
  const day = e.target.closest('[data-date]');
  if (day) {
    calSelected = day.dataset.date;
    calPicker = false;
    renderCalendar();
    openDateSheet(day.dataset.date);
  }
});
// Clicking away closes the month picker.
document.addEventListener('click', (e) => {
  if (calPicker && !e.target.closest('.cal__head')) { calPicker = false; renderCalendar(); }
});

// The "Every year from now on" modal is gone. Ticking a box that already says
// "Remind me every year" and then being asked to confirm it in a pop-up reads
// as a second, different question. The reminder notice under the field says
// what will happen, which is enough.
dashboard.addEventListener('change', (e) => { if (e.target.closest('.prefs')) syncPrefsSummary(); });
// Keep the reminder notice honest as the date or the yearly tick changes.
const refreshNotice = (e) => {
  const form = e.target.closest('form');
  const out = form && $('[data-reminder-notice]', form);
  if (!out) return;
  out.textContent = reminderNotice(form.elements.occasion_date?.value, form.elements.recurring_yearly?.checked);
};
dashboard.addEventListener('change', refreshNotice);
dashboard.addEventListener('input', refreshNotice);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#dayChoice').hidden) closeDayChoice();
});

// The editor is re-rendered constantly, so its picture controls are delegated.
dashboard.addEventListener('change', (e) => {
  const input = e.target.closest('[data-edit-file]');
  if (!input) return;
  Array.from(input.files || []).forEach(uploadEditPhoto);
  input.value = '';
});
['dragover', 'dragenter'].forEach((ev) => dashboard.addEventListener(ev, (e) => {
  const drop = e.target.closest('[data-edit-drop]');
  if (drop) { e.preventDefault(); drop.classList.add('is-drag'); }
}));
dashboard.addEventListener('dragleave', (e) => e.target.closest('[data-edit-drop]')?.classList.remove('is-drag'));
dashboard.addEventListener('drop', (e) => {
  const drop = e.target.closest('[data-edit-drop]');
  if (!drop) return;
  e.preventDefault();
  drop.classList.remove('is-drag');
  Array.from(e.dataTransfer?.files || []).forEach(uploadEditPhoto);
});

dashboard.addEventListener('click', accountAction);
dashboard.addEventListener('submit', (e) => {
  if (e.target.matches('[data-save-date]')) saveDate(e);
  if (e.target.matches('[data-reorder-form]')) sendReorder(e);
});
$('#signOut').addEventListener('click', async () => { await supabase.auth.signOut(); setNavName(''); forgetMe(); location.reload(); });

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
    doneChecking(); authBox.hidden = false; dashboard.hidden = true;
    showPanel('recovery');
    authStatus.textContent = 'Choose your new password.';
    return;
  }
  loadAccount(session);
});
supabase.auth.getSession().then(({ data }) => loadAccount(data.session));
