# Hazel's Cake Lounge — Project Memory

The single running record of this project. Every AI session (Claude Code, Codex, or any
other) reads this file before working and appends to it after working.

**Never put secrets in this file.** No API keys, tokens, passwords or client secrets.
Record that a credential exists and where it lives, never its value.

Last updated: 08/08/2026

---

## 1. What this is

- **Business:** Hazel's Cake Lounge, a custom cake bakery in South Africa.
- **Public site:** https://hazelscakelounge.co.za (root redirects to `www.`)
- **Admin:** https://admin.hazelscakelounge.co.za
- **Repository:** `C:\Users\supra\OneDrive\Documents\HCL`
- **GitHub:** `13gumedemp-collab/hazels-cake-lounge`, branch `main`
- **Domain:** registered through Vercel, on Vercel nameservers, verified.
  `hazelcakelounge.co.za` (singular) is a *different third-party domain* and must never
  be used as a target.

## 2. Architecture

| Piece | Stack | Location | Vercel project |
|---|---|---|---|
| Public site | Static HTML/CSS/JS built by Vite 5 | repo root | `hazels-cake-lounge` |
| Admin | Next.js 14.2.35, React 18, Tailwind, Node 24 | `admin/` | `hazels-command-centre` |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) | `supabase/` | — |
| Email | Resend | `supabase/functions/_shared/email.ts` | — |

- Vite entry points are declared explicitly in [vite.config.js](vite.config.js). **Adding a
  new page means adding it to `rollupOptions.input`, or it silently will not build.**
- Vercel IDs: project `prj_yDGfitUPfAcXrA2RgiYoT9I1XTvK`, team
  `team_f2rrWrh7T89Jr1089ET6jRbG`, scope `13gumedemp-collabs-projects`, account
  `13gumedemp-collab` (not Ofentse's).
- Supabase project ref: `qgzpoyyijafblzfiyhoc`. CLI is authenticated and linked on this
  machine; its personal access token lives in Windows Credential Manager under target
  `Supabase CLI:supabase`. Never print it.
- Google Cloud project for OAuth: `hazels-cake-lounge-auth`, number `732761854674`.
  gcloud CLI is authenticated as `13gumedemp@gmail.com`.

### Public pages
`index` · `menu` · `work` · `story` · `reviews` · `contact` · `occasion-book` · `save-date` ·
`messaging-terms` · `terms` · `privacy` · `account`

### Supabase migrations (all applied)
`0001_initial_schema` · `0002_cron_daily_occasion_checker` · `0003_whatsapp_reminders_due` ·
`0004_circle_model` · `0005_orders_completed_at` · `0006_retire_occasions` ·
`0007_customer_accounts` · `0008_social_login_hardening` · `0009_account_creation_alerts` ·
`0010_split_customer_name` · `0011_backfill_customer_auth_links` · `0012_customer_login_activity` ·
`0013_circle_dates_any_day` · `0014_normalise_occasion_types` · `0015_circle_member_photos` ·
`0016_phone_calls_are_service`

**Never reuse a migration version prefix.** A duplicate `0009` already caused a failure
once and had to be renamed to `0010`.

### Edge functions
`_shared` · `account-created-alert` · `add-circle-member` · `customer-file` ·
`daily-occasion-checker` · `enquiry-followup-check` · `generate-invoice` ·
`generate-memory-card` · `process-enquiry` · `request-callback` · `send-circle-followup` ·
`send-email` · `update-order-status` · `delete-account`

---

## 3. Standing rules

### Development and deployment — **localhost first, as of 08/08/2026**

- **Do not deploy to Vercel as part of routine work.** The free plan allows 100
  deployments per project per day and the account has already hit
  `api-deployments-free-per-day`, which blocks every deploy for 24 hours.
- Verify changes locally instead:
  - Public site: `npm run dev` → http://localhost:5173
  - Production-equivalent check: `npm run build` then `npm run preview`
  - Admin: `cd admin && npm run dev` → http://localhost:3000
- The admin dev server is slow to start on this machine because the repo sits in OneDrive:
  roughly 30s to "Ready" and then a further ~100s compiling on the first request. It is
  not hung. An unauthenticated `GET /` correctly answers `307 → /login`.
- Committing and pushing to GitHub is still fine and expected — pushing does **not**
  trigger a deploy here; deploys are CLI-only.
- Deploy only when the user explicitly asks. Batch several changes into one deploy.
  Command: `npx vercel --prod --yes --scope 13gumedemp-collabs-projects` from the repo
  root, then confirm the deployment is Ready **and** aliased to
  `https://hazelscakelounge.co.za`.
- To deploy without picking up another session's uncommitted edits:
  `git worktree add --detach <tmp> <commit>`, copy `.vercel` into it, run the CLI there.

### Design and voice

- Premium black and gold. Preserve the cinematic motion and editorial typography.
- Admin uses a soft white/ivory palette with restrained muted gold — deliberately *not*
  the dark public palette.
- UK English and South African conventions. No em dashes in customer-facing copy.
- First person throughout the public site — "I bake", "my story". Hazel is speaking.
- Possessives: names ending in `s` take a bare apostrophe, everything else `'s`.
- The nav account link must **never** say "My Account" — "My Work" and "My Story" are
  Hazel's pages, so "My" reads as Hazel. Use "Your Account" when the visitor is unknown
  and "<First name>'s Account" once known.
- **The same trap applies to every button and heading, not just the nav link.** Because
  the whole site is first person as Hazel, any customer-facing "I" or "my" is read as
  Hazel. "See what I owe" says Hazel owes the customer money; "Delete my account" reads as
  Hazel deleting hers. Address the customer as "you" and reserve "I"/"my" for Hazel
  actually speaking ("I bake", "my kitchen", "what I have sent you"). Consent tick boxes
  are the one exception, where "Email me my reminders" is the normal convention.
- Mobile layouts must be explicitly verified, not assumed.
- `--liquid-button-fill` is `0px` site-wide: buttons rest empty and only flood gold on
  hover or tap.

### Business rules

- Minimum lead time is **four full calendar days** on every cake enquiry and reorder. It
  is a *baking* lead time, so it does **not** apply to the Occasion Book: a saved date is
  a free reminder with nothing baked for it, and any date may be saved, including one in
  the past. The site says honestly when a date is too close for the usual reminders.
  (The database disagreed with this until migration `0013`. See the 08/08/2026 entry.)
- Occasion Book reminder cadence: one month, two weeks, one week before the date.
- The Occasion Book is a *free reminder service*, not an order. Saving a date involves no
  enquiry, no reservation and no payment.
- Community rating prompts: two stars → "What went wrong?", three stars → "What could I
  have done better?".
- Payment states Hazel controls from the admin order board: unpaid, deposit paid, paid in
  full.
- Duplicate-photo rule: photos of the same product that look alike are duplicates, keep
  one.

### Working method

1. Read this file first.
2. Keep changes tightly scoped; preserve unrelated working-tree files.
3. Build and verify locally.
4. Commit and push to `main` (direct to main is intended — it is the user's own repo).
5. **Append a dated entry to §5 of this file** before reporting the work as done.

---

## 4. Hard-won lessons (do not relearn these)

- **`const` callbacks in `setTimeout` blew up the whole site.** `setTimeout(fallback, 3500)`
  ran while `fallback` was still in its temporal dead zone. The ReferenceError aborted the
  rest of `main.js`, the loader curtain never lifted, and every first page view of a
  session rendered black. Arm timers only *after* the function is defined. Builds and
  syntax checks do not catch this — it is a runtime error.
- **A `display: grid` rule beats the user-agent `[hidden]` rule.** `.account-login-form`
  set `display: grid`, so every auth panel rendered at once on one long scroll.
  `.account-auth [hidden] { display: none !important; }` fixes it. Check this whenever a
  hidden element still shows.
- **Deployment skew blanks pages.** The browser or Vercel edge holds HTML from an earlier
  deployment whose hashed asset filenames no longer exist, so every script 404s. Diagnose
  by fetching with a cache-busting query, listing the `assets/...` names and requesting
  each; `X-Vercel-Error: NOT_FOUND` confirms it. It self-heals on edge revalidation. It
  appears when several production deployments land in quick succession — another reason
  to batch deploys.
- **The global custom-select enhancer runs before dynamically-created options exist**, so
  it produces an empty dropdown. ~~The account date sheet keeps a native `<select>` for
  this reason.~~ **Fixed 08/08/2026.** The workaround was worse than the bug: the closed
  field was styled but the open list was drawn by the operating system, so it appeared as
  a grey Windows menu in the middle of the black and gold page. The right fix is ordering,
  not opting out — build the options, then call `window.hclEnhanceSelects(root)` on that
  subtree. Two things to know if you touch it: build the options **once**, because
  rewriting `innerHTML` orphans the enhanced menu already sitting beside the select; and
  the enhanced menu only re-labels itself on a `change` event, which neither `form.reset()`
  nor setting `.value` fires, so dispatch one by hand.
- **Do not reach for the Google Calendar API. Use a template URL and an .ics file.**
  Writing events into a customer's calendar needs the `calendar.events` OAuth scope, which
  Google classes as **sensitive**. The consent screen was published without a verification
  review precisely because the app asks only for `email`, `profile` and `openid`, which are
  non-sensitive (see the thread 7 brief). Adding a calendar scope would drop the app back
  into verification: demo video, privacy policy audit, weeks of waiting, and degraded
  sign-in for every customer while it sat in review. It would undo finished work for a
  convenience feature. The `calendar.google.com/calendar/render?action=TEMPLATE` URL needs
  no scopes, no API and no review, and a generated `.ics` covers Apple and Outlook. Both
  also work for customers who signed up with an email address and have no Google account,
  which the API route never could.
- **The autofill fix must be the LAST thing in `styles.css`.** Getting the transition trick
  right is only half of it. `input:-webkit-autofill` and `.field input` have the **same
  specificity (0,1,1)**, so when the autofill block sat near the top of the file,
  `.field input` several hundred lines later — with its own `transition: border-color …` —
  replaced the long transition outright and the pale blue background snapped straight back.
  The giveaway that this is what is happening: **the text is the right colour but the
  background is still blue**, because `.field input` sets `color`, not
  `-webkit-text-fill-color`, so only the transition was lost. Two defences now: the block
  lives at the end of the file, and the pseudo-class is repeated
  (`input:-webkit-autofill:-webkit-autofill`) to lift specificity to (0,2,1). Do not move
  it back up, and do not add form rules after it.
- **Never enhance a `<select>` that has no options yet.** The startup pass builds an empty
  branded menu labelled "Select" and sets `dataset.enhanced`, so the later
  `hclEnhanceSelects` call after the options are added does nothing and the dropdown is
  dead. `enhanceSelect` now returns early on an empty select *without* marking it. This bit
  twice: first as the reason the sheet was left native, then again the moment it was not.
- **An `overflow` on a card clips the branded dropdown inside it.** The panel is absolutely
  positioned, so any scrolling ancestor cuts it off. `.ecard--editing` hit this first; the
  date sheet hit it again when its dropdown stopped being native. Put the scroll on the
  backdrop, not on the card.
- **No provider can send email from a free mail domain.** `RESEND_FROM_EMAIL` held
  `hazelscakelounge@gmail.com`, so Resend returned 403 on every send and enquiry
  confirmations, reminders and invoices silently never delivered. It is now
  `hello@hazelscakelounge.co.za`.
- **Do not use `supabase config push` to change auth settings.** It pushes the whole auth
  block including the Google provider secret as an unresolved `env()` reference and can
  blank it, breaking Google sign-in. Use the dashboard or a PATCH to
  `https://api.supabase.com/v1/projects/<ref>/config/auth`, which only touches the fields
  sent.
- **The brand intro must only ever run on the home page.** It was once gated inside a
  `catch` branch, so it ran everywhere and held a 4 MB video behind a black curtain.
- **Facebook and Google can return an account with no email and no name**, which violated
  the `customers` NOT NULL columns. Migration 0008 falls back to a
  `no-email+<uuid>@hazelscakelounge.co.za` placeholder with `email_consent` false.
- **Vercel needs the default Next.js output directory** for the admin. A local OneDrive
  cache workaround changed it and broke the build (fixed in `e242d43`).

---

## 5. History

Attribution note: work up to and including 22/07/2026 spans both Claude Code and Codex
sessions; the 22/07 mobile-loader session was Codex. Later sessions were Claude Code.
Where the tool is not certain it is not claimed.

### Phase 1 — Site build, 22/06/2026 – 23/06/2026
- `5f72a79` initial cinematic editorial site; `092d5c8` multi-page split (menu, story,
  enquire, contact), liquid buttons, spatula cursor, kinetic headers, phone number.
- Cinematic dropdowns, mobile tap-to-fill buttons, mobile menu carousel and overflow fix.
- Real photography wired in from `public/images` with stock fallbacks; `.png` extension
  bug fixed so Cakes, Cupcakes and gallery images always render.
- First-person voice applied throughout; My Work gallery page; Motion-style landing
  carousel with scroll-linked scaling and proximity snap; My Story portrait; inspiration
  image upload on the enquiry form; Hazel's Community page with star rating and review
  wall.

### Phase 2 — Backend and the Circle model, 25/06/2026
- `a4eebbc` Supabase schema, RLS and a pg_cron schedule for occasion reminders.
- `84baa1f` shared edge-function helpers and `send-email`; env files gitignored.
- `441f049` / `4d104e0` enquiry form wired to occasion registration, full reminder engine,
  24-hour nudge, yearly reset, order pipeline.
- `f94e36d` → `86ea04c` master spec: Circle model schema, `inspiration-photos` bucket,
  re-seeded email templates, all 8 functions moved onto the Circle model, occasions
  retired.
- Enquire and Contact merged into one Contact page with a redirect from the old URL.
- `cfcbc1f` enquiry overhaul: pronoun-aware wording, optional name, custom occasions,
  multi-image upload with a CORS fix, My Work filters, exit-popup contact choice, footer
  legal links.
- `ce5eb42` separate Terms and Privacy pages: no refunds, full payment,
  collection/delivery.
- Admin dashboard scaffolded, then given the black/gold palette, drag-and-drop order
  board, fanning notification list and welcome splash.

### Phase 3 — Admin cache wars, 25/06/2026 – 26/06/2026
- A stale service worker kept serving frozen orders and notifications. Fixed across
  `9879baa` → `6eaa5e0`: tear down the SW and clear caches, cache-bust the notification
  fetch, serve dashboard figures from a live `/api/stats` client fetch, force `no-store`
  on all Supabase server reads because Next.js was caching queries, stop the teardown
  auto-reloading, and finally ship a self-removing kill-switch SW.

### Phase 4 — Mobile and Occasion Book, 22/07/2026 *(Codex)*
- `fe8f834` mobile loader shows only "Hazel's" (Mobile Safari rendered clipped fragments
  of the animated subtitle); the full-screen menu got an opaque stacking layer, scroll
  lock, and link/Escape closing.
- `1824b95` / `9fbbd53` Occasion Book copy simplified, separating saving a date from
  placing an order.
- `56df1fe` / `a37c626` Occasion Book image uploads: multiple inspiration pictures per
  occasion via tap, file picker or drag and drop, into the private `inspiration-photos`
  bucket, HEIC accepted, 15 MB per picture. Paths are saved per-occasion in its notes so
  the existing edge function retains them without a redeploy. "Add another occasion" stays
  disabled until the current block has a type and date.
- `ae11cc9` customer accounts and admin payment tracking. Public portal at
  `/account.html`; migration `0007` added auth linking, SA-only profile fields, payment
  fields, phone-call consent, RLS, manual call tasks and a reorder RPC honouring the
  four-day lead time. Admin protected in the dashboard server layout and every sensitive
  API route. Next.js updated to 14.2.35, Node 24 selected.

### Phase 5 — Identity, sign-in and email, 29/07/2026
- `4b84fed` duplicate cupcake photos removed (kept `work-ed-11`, `-33`, `-18`, `-21`);
  account named after the customer, first name cached in `localStorage` under
  `hcl.firstName`.
- `7388d67` Google sign-in enabled in Supabase; account page moved to the current
  publishable key after the legacy key was rejected.
- `3fcb69f` → `01dfef2` sign-in rebuilt: magic link removed in favour of Google, password
  sign-in and a two-step create-account flow with an emailed 8-digit code; forgotten
  password with a `recoveryMode` flag; migration `0008`; stacked-panel bug fixed;
  cinematic panel transitions, disabled under reduced motion.
- `bec6b42` Facebook sign-in removed at the user's request — the Meta app, business
  verification and Live review were more surface than it earned.
- **Email delivery was broken and is now fixed.** Root cause was `RESEND_FROM_EMAIL`
  holding a Gmail address. Now `hello@hazelscakelounge.co.za`, with `BUSINESS_EMAIL`
  still the Gmail address because that is where Hazel receives. `_shared/email.ts` sets
  `reply_to` to `BUSINESS_EMAIL` since no mailbox exists on the sending domain. Resend
  wrote DKIM/SPF/bounce-MX DNS through its Vercel integration; a `_dmarc` TXT
  (`v=DMARC1; p=none;`) was added with no `rua`. Inbound forwarding is live through
  forwardemail.net — root MX to `mx1`/`mx2.forwardemail.net` plus a root TXT
  `forward-email=hazelscakelounge@gmail.com` — so anything sent to any address at the
  domain lands in Hazel's Gmail. Supabase Auth SMTP now points at `smtp.resend.com:465`,
  user `resend`, and `rate_limit_email_sent` was raised from 2/hour to 30. The "Confirm
  signup" template was replaced with branded HTML containing `{{ .Token }}` and the link.
- **Brand entrance saga**, `9b9e6f8` → `3953bc9`, six versions. Session-keyed
  `hcl-brand-intro-v1..v6`, home page only. Ended at v6: the start fallback applies only
  until playback begins, then the site reveals at the clip's `ended` event so visitors
  see the full animation. `7abf623` fixed the black-screen ReferenceError described in §4.
- `4648d96` / `4a634ca` / `bf3be77` / `b4f0e68` admin visual overhaul, soft-ivory
  repalette, and the new illuminated H brand mark across public header, favicons, admin
  sign-in and collapsed navigation. Expanded admin sidebar stays a text wordmark.
- `a08809e` admin responsive audit: desktop sidebar now activates at 1024px so portrait
  tablets get the drawer, safe-area bottom spacing, 44px touch targets, mobile-safe
  notification panel, constrained order-board columns.
- `84ff39a` account creation alerts: notification popover rebuilt as a readable
  soft-ivory feed; migration `0009`; edge function `account-created-alert` emails
  `hazelscakelounge@gmail.com` once per new account, skips accounts older than 24 hours,
  and raises a high-priority dashboard notification if sending fails.
- `f344e46` → `bd76bb3` account dashboard rebuilt with a real month grid, order detail,
  consent and names. `.cal__head` given `position: relative` so the month picker opens
  beneath its trigger instead of far below. Migration `0011` backfilled `auth_user_id` for
  legacy `customers` rows whose email matched an auth user, restoring their access.
- `9efb53d` Occasion Book accepts any date, with honest reminder wording and a working
  dropdown.
- `c26b088` public responsive hardening across all 11 pages: navigation switches to the
  touch menu at 1024px with focus trapping and restoration, safe-area support for notched
  phones, touch-size controls, scroll-safe work filters, compact account sheets.
  **This commit was never deployed** — the Vercel free-tier daily deployment limit was
  reached. The live site still runs the prior deployment.

### 08/08/2026 — Project memory and localhost workflow *(Claude Code)*
- Created this file as the permanent home for project memory, consolidating everything
  above from the previous Claude Code and Codex session notes plus the full commit history.
- Added [CLAUDE.md](CLAUDE.md) so every future session loads these rules automatically.
- Switched the standing workflow to **localhost verification only**. Vercel deploys now
  happen only on explicit request, to stop exhausting the free-tier daily limit.
- Verified both halves of that workflow end to end: `npm run build` succeeds on all 11
  public pages, the Vite dev server serves `/`, `/account.html` and `/work.html` with 200
  on port 5173, and the admin dev server answers on port 3000 with the expected
  `307 → /login` redirect for an unauthenticated request.
- Investigated publishing the Google OAuth consent screen and established it cannot be
  automated: the IAP OAuth Admin APIs were shut down on 19/03/2026 and no public API sets
  publishing status for an External app. Handed to Codex as open thread 7 with a brief.
- Side effect: the `gcloud alpha` component was installed on this machine during the
  investigation. Harmless, but it was not there before.

### 08/08/2026 Google OAuth Console handoff (Codex)
- Confirmed the existing Google Cloud OAuth project is `hazels-cake-lounge-auth`
  (number `732761854674`) under `13gumedemp@gmail.com`. Do not create a replacement
  project. Confirm the existing External consent screen's publishing status in Google
  Cloud Console, then publish it only if it is still in Testing.

### 08/08/2026 Google OAuth production publication (Codex)
- Published the existing External OAuth consent screen for `hazels-cake-lounge-auth`
  from Testing to In production in Google Cloud Console under `13gumedemp@gmail.com`.
- Confirmed through the authenticated Supabase management API that Google Auth is enabled
  and has a configured client ID, client secret, site URL, and redirect URLs. No Supabase
  configuration or secret needed changing.

### 08/08/2026 Email account-path verification (Codex)
- Confirmed through the authenticated Supabase management API that email sign-ups are
  enabled, email confirmation is required, the eight-digit confirmation-code template is
  active, SMTP credentials and sender identity are configured, and the production account
  redirect is allowed. The deployed account page and its hashed JavaScript asset both load
  successfully and contain the email sign-up, resend, and code-verification path.
- Supabase's log-query backend returned a generic backend error, so no historical Auth
  error could be attributed. No test account or email was created; open thread 6 remains
  the required end-to-end verification.

### 08/08/2026 Recovery-state sign-up fix (Codex)
- Fixed `account.js` so recovery mode begins only on Supabase's `PASSWORD_RECOVERY`
  event. A stale recovery URL is cleared when a customer starts a normal sign-in or
  sign-up, and after successfully setting a new password. This prevents a new email
  account from being diverted to the "Create a new password" screen.
- `node --check account.js` and `npm run build` both pass. The change is local only and
  requires the next explicitly authorised Vercel deployment to reach customers.

### 08/08/2026 Admin activity-feed cleanup (Codex)
- Local changes now hide historic all-zero `daily_check` rows from both the notification
  bell and Recent activity. The daily checker will no longer create a notification when
  it finds no work; when it does find work, it records only the non-zero outcomes and
  promotes failures to high priority.
- Added local migration `0012_customer_login_activity` and the authenticated
  `account-login-activity` edge function. A returning customer will create one standard
  activity item per SAST day; a new account keeps its existing account-created activity
  instead of producing a duplicate login item. New enquiry, callback request, overdue,
  follow-up, reminder-task and email-failure notifications are unchanged.
- Changed TypeScript and edge-function sources parse successfully, `node --check
  account.js` passes, and `npm run build` passes. The work is not deployed.

### 08/08/2026 Local admin password update (Codex)
- Updated the local-only `admin/.env` admin password at the user's request. The running
  local Next.js server must be restarted before it reads the new value. Production hosting
  credentials were deliberately left unchanged.

### 08/08/2026 Recent activity triage (Codex)
- Rebuilt the local admin Recent activity card with Urgent, Not urgent, FYI and All tabs.
  Urgent contains high-priority action items; non-urgent is reserved for customer call and
  WhatsApp tasks; FYI holds informative order, account and delivery updates.
- Added presentation rules that turn historic all-zero daily rows into a concise summary
  and replace raw Resend JSON error payloads with a plain-language delivery explanation.
  Future email-failure notifications are also written in that concise form; raw provider
  detail remains only in `reminder_log` for technical diagnosis.
- Changed TypeScript sources parse successfully. The local dev server should refresh this
  view automatically; production remains unchanged until an authorised deployment.

### 08/08/2026 Resend delivery diagnosis (Codex)
- The live Supabase email configuration is complete: email sign-up and confirmation are
  enabled, and Auth is configured for `smtp.resend.com:465` with the verified
  `hello@hazelscakelounge.co.za` sender. The edge-email source also reads
  `RESEND_API_KEY` correctly and adds the Bearer prefix exactly once.
- The Resend failure shown in the admin activity is therefore a rejected credential, not
  a sender-domain or application-code issue. Supabase exposes only a digest when listing
  edge secrets, so it cannot safely reveal or independently validate the stored key.
  No secret or SMTP setting was changed during this diagnosis.

### 08/08/2026 Resend credential replacement (Codex)
- Replaced the `RESEND_API_KEY` edge secret and the Supabase Auth SMTP password with the
  user-provided Resend sending key. The key authenticates successfully: its read-only
  domain request returns Resend's `restricted_api_key` response, which is expected for a
  sending-only key rather than an invalid-key response.
- Restored and verified the complete Auth SMTP configuration after the Management API
  cleared omitted SMTP fields in an initial partial update: `smtp.resend.com:465`, user
  `resend`, sender `hello@hazelscakelounge.co.za` named Hazel's Cake Lounge, email sign-up
  enabled, confirmation required, and secure email changes enabled. No test message was
  sent. The replacement key must be rotated again when practical because it was supplied
  in chat; do not paste its replacement into chat.
- With explicit approval, a single plainly labelled test was sent to Hazel's Gmail on
  08/08/2026. Resend accepted it with HTTP 200 and returned a message identifier, which
  confirms the sender, credential and sending permission work end to end at the provider.

### 08/08/2026 Migration `0012` confirmation (Codex)
- Confirmed `0012_customer_login_activity.sql` is final. It creates only the
  RLS-protected login-activity table required by the already-written edge function; the
  function uses the service role, so no customer-facing RLS policy is required. Do not
  edit or renumber it. `npx supabase db push` may now apply `0012`, `0013` and `0014` in
  order when deployment is authorised.

### 08/08/2026 — Autofill colours, and the account tabs split *(Claude Code)*
- **Browser autofill no longer breaks the palette.** An autofilled email sat in an opaque
  pale blue box with near-black text on the black account page. The cause is worth
  recording because it defeats the obvious fix: Chrome and Safari paint autofill from a
  **user agent `!important`** rule, and the cascade places user agent `!important`
  *above* author `!important`, so no override — not even `!important` — can reach it.
  Transitions are the only origin ranked higher. The fix is therefore
  `transition: background-color 600000s 0s, color 600000s 0s, -webkit-text-fill-color
  600000s 0s`, a delay long enough that the new paint never arrives, plus
  `-webkit-text-fill-color` for the glyphs (the user agent sets `color` but not the fill
  colour, and the fill colour wins when both are present). Applied globally to
  `input`/`textarea`/`select` in [styles.css](styles.css), covering all 11 public pages,
  and again with the ivory palette in [admin/app/globals.css](admin/app/globals.css).
  Firefox needs the separate standards `:autofill` selector, kept in its own rule because
  one unknown selector would void the whole list. Verified the rules survive minification.
- **"What you agreed to" is gone.** It was a collapsed `<details>` buried at the bottom of
  a long "Your details" form, which is the wrong place for the one screen where a customer
  decides what lands on their phone. The three consents now live in their own
  **Notifications** tab as readable cards, each saying what it actually sends, with their
  own save button and a live one-line summary of what is switched on. Ticking WhatsApp or
  phone calls with no number saved now warns and links across to Your details.
- **New "Sign in" tab** holding email change and password, moved out of the profile panel.
  The password flow is properly built now: Supabase changes a password on the strength of
  the session alone, so an unattended unlocked browser was enough to lock the owner out.
  It now verifies the current password first via `signInWithPassword` (same user, so the
  session is undisturbed), rejects reusing the current password, and has a four-band
  strength meter and show/hide toggles. Google-only accounts are detected from
  `user.identities` and get "Add a password" wording with the current-password field
  removed, because they have never had one. `setUpSecurity` re-fetches the user when
  `getSession` returns no identities, since local storage does not always carry them.
- Account tabs are now: Calendar · Orders · Occasion Book · Your details · Notifications ·
  Sign in. Tab switching was factored into `showAccountTab(name)` so links can jump
  between panels via `data-goto-tab`.
- Verified on localhost only, per the standing rule. `npm run build` passes on all 11
  pages and the dev server returns 200 for `/`, `/account.html`, `/contact.html` and
  `/occasion-book.html`. Not deployed.

### 08/08/2026 — The account becomes a real dashboard *(Claude Code)*

Six changes, all on `account.html` / `account.js` / `styles.css` unless stated.

- **Overview is the new first tab.** Calendar as the landing page made the customer do the
  reading. Overview answers "is anything happening?" with one next-up card, four figures
  (dates coming up, cakes in the kitchen, amount owing, dates saved) that each jump to
  their tab, and three actions.
- **Orders split into "In the kitchen" and "Collected".** A cake being made and a cake
  already eaten are different questions; one list buried the live work under the history.
- **New Payments tab.** Outstanding total across all cakes, per-order balances with the
  progress bar, and invoice/receipt buttons. These were previously reachable only by
  opening an order card.
- **Notifications gained a sent log.** Worth recording: **this needed no migration.**
  `reminder_log` has recorded every send since `0001`, `_shared/email.ts` writes to it on
  success, failure *and* skip, and `0007` already granted customers RLS read access to
  their own rows (`customer_reads_reminders`). So it is a pure frontend read. Failed and
  skipped sends are shown, not hidden, because that is the entire point of the list.
  Template names are mapped to human labels in `SENT_LABELS`.
- **Sessions and "sign out everywhere"** via `signOut({ scope: 'global' })`. Supabase has
  no API for listing a user's sessions, so the panel states only what is knowable — last
  sign in, account created, sign-in methods — rather than inventing a device table.
- **Account deletion**, new edge function `delete-account`. The cascade does the right
  thing on its own: `customers` is deleted, `circle_members` goes with it via ON DELETE
  CASCADE, while `orders` and `reminder_log` keep their rows with `customer_id` set to
  null. So personal data is erased and sales records survive anonymised, which is what
  SARS five-year retention requires. The function trusts nothing in the body — the caller
  is identified from their own JWT, so there is no id to tamper with.
- Also fixed on the way: the possessive rule from §3 was not being applied to customer
  names. Added a `possessive()` helper so a name ending in `s` takes a bare apostrophe.

**Verification.** A stub-DOM smoke test was written for this session because `node --check`
and `vite build` both pass on the exact bug §4 warns about — a module-level ReferenceError
or a listener bound to a missing element, either of which aborts the rest of the file. The
built bundle now evaluates with no module-level error and every `#id` it looks up exists in
`account.html`. Build passes on all 11 pages, dev server returns 200. Not deployed.

**Not yet live.** `delete-account` is written but **not deployed**, so the delete button
will fail until someone runs `npx supabase functions deploy delete-account`. Nothing else
in this session needs a deploy.

### 08/08/2026 — Date sheet: branded dropdown and a real dialog *(Claude Code)*
- The occasion dropdown in the account calendar's save-a-date sheet was a native
  `<select>`, so Windows drew a grey system list over the black and gold page. Now
  enhanced like every other select. See the corrected §4 lesson above for the ordering
  rule and the two gotchas.
- The sheet itself was a bottom sheet at every width. On a laptop that welded a
  square-cornered panel to the bottom edge, half over the calendar, reading as stuck
  rather than as a dialog. It is now a centred modal above 560px and still a bottom sheet
  below it, with a blurred backdrop, Escape to close, and a body scroll lock. The scroll
  moved from the card to the backdrop so the new dropdown is not clipped.
- **Noted but not changed: the two save-a-date forms disagree.** The Occasion Book offers
  7 occasion types (`Baby Shower`, `Just Because`, title case) and the calendar sheet
  offers 10 (`Baby shower`, `Just because`, sentence case). Both write the same
  `circle_members.occasion_type` column, so the same customer's records are inconsistent
  depending on where they saved. The Occasion Book also captures relationship, notes and
  inspiration photos and treats the name as optional; the sheet requires a name, captures
  none of the rest, and saves the literal string "Other" with no follow-up field, so a
  reminder can go out reading "Other". Opened as thread 10.

### 08/08/2026 — Saving dates: one list, one flow, and a live bug found *(Claude Code)*

- **New [occasions.js](occasions.js), the single source for occasion and relationship
  lists.** There were *three* copies: the Occasion Book page (hardcoded `<option>`s), the
  enquiry overlay (`OCC_OPTS`/`REL_OPTS` in main.js) and the account sheet (`OCCASIONS` in
  account.js). Seven types in title case in two of them, ten in sentence case in the
  third, all writing the same `circle_members.occasion_type`. Now ten, sentence case, one
  file. `optionsHtml()` keeps an older value selected rather than showing it as an unknown
  extra, and `canonicalOccasion()` matches "Baby Shower" to "Baby shower".
- **"Other" now asks what the occasion actually is** in the account sheet. It used to save
  the literal string "Other", and that string goes straight into reminder subject lines.
- **Repeat every year now defaults from the occasion** (a birthday repeats, a wedding does
  not) and stops guessing once the customer touches the box. Unticking it now carries a
  plain warning, because `daily-occasion-checker` does `if (!m.recurring_yearly) continue`
  — a one-time date gets **no reminders at all**, not fewer. Verified in the function
  before writing the copy.
- **A saved date now offers "Order a cake for this"** from the calendar detail card.
  `openOverlay()` in main.js takes a prefill object, and the trigger carries the occasion,
  person, date and relationship in its dataset, so nothing is retyped.
- **Drag a saved date to another day.** Pointer only, and deliberately so: HTML5 drag
  events never fire on touch, and the Occasion Book tab's Edit form is the better phone
  interaction anyway. Only draggable when the day holds exactly one saved date, so there
  is never ambiguity about what moved. Orders are never draggable.
- **Add to calendar, offered after saving.** Two routes, and the choice matters: a Google
  Calendar **template URL**, and a generated **.ics** for Apple, Outlook and everything
  else. See §4 for why the Calendar API was not used.
- **The sheet is now honestly the quick path**, with a link through to the full Occasion
  Book form carrying `?date=` so the tapped day is prefilled.

**Live bug found and fixed in [0013](supabase/migrations/0013_circle_dates_any_day.sql).**
`customer_adds_circle` from `0007` requires `occasion_date >= current_date + 4`, but commit
`9efb53d` changed the front end to accept any date and to say honestly when one is too
close for reminders. The policy was never changed to match, so the page showed the friendly
message and then the database refused the insert. Saving today's birthday failed with a
raw policy error. The four day rule is a *baking* lead time and belongs on orders, where
`request_reorder` still enforces it, not on a free reminder. `friendlyDateError()` explains
the failure in the meantime.

**Not applied.** Migrations `0013_circle_dates_any_day` and
`0014_normalise_occasion_types` are written but **not pushed**. Until `0013` is applied
the near-date bug is still live. `0012_customer_login_activity` is final and is queued
ahead of them.

### 08/08/2026 (later) — One form for saving a date *(Claude Code)*
- **Dropdown bug, mine, fixed.** Removing `data-native-select="true"` exposed the sheet's
  select to the startup `$$('select').forEach(enhanceSelect)` pass, which ran while it had
  no options, built an empty menu labelled "Select", and set `dataset.enhanced`. The later
  `hclEnhanceSelects` call was then a no-op and the dropdown stayed permanently empty.
  `enhanceSelect` now returns early on a select with no options **without** marking it
  enhanced, so the later call does the work. Added to §4.
- **The quick save-a-date sheet is gone.** Tapping a calendar day now goes to
  `occasion-book.html?date=…` with the date prefilled. The sheet captured only a name and
  an occasion, so the same action produced a weaker record depending on where it was
  started. One form, one standard. About 165 lines of `account.js` and the whole
  `#dateSheet` markup went with it.
- **First name and surname, both required**, on the Occasion Book form. It was one
  optional field, so reminders could go out with no name or a first name only. Still one
  `person_name` column, joined on save.
- **Add to calendar moved to the Occasion Book success state**, and the helpers moved into
  [occasions.js](occasions.js) so both pages share one implementation. Still a Google
  template URL plus an `.ics`, never the Calendar API. See §4 for why.
- **The four-day check was still being enforced in the Occasion Book submit handler.**
  Removed, to match the business rule in §3 and migration `0013`.
- **Overview actions rewritten.** Three bare labels became three cards that each say what
  the thing actually does.
- **"Owing" language removed throughout.** Payment is agreed on a phone call and nothing
  is charged through the site, so a balance is a record, not a demand. "Still to pay" and
  "Outstanding" became "your balance"; "Fully paid" became "Settled"; the Payments tab now
  states plainly that nothing is ever charged through the site.

### 08/08/2026 (later still) — A date means two things *(Claude Code)*
- **New page [save-date.html](save-date.html)**, added to `rollupOptions.input`. A focused
  save-a-date form with no marketing to read past. The Occasion Book page keeps the
  explaining; this is for someone who has already decided.
- **The occasion block markup moved into `occasionBlockHtml()` in
  [occasions.js](occasions.js)** and the `<template id="occBlockTpl">` was deleted from the
  page. Two pages now render the same block, and copying the markup is exactly how the
  three occasion lists drifted apart earlier the same day. `main.js` builds the node from
  the shared string instead of cloning a template.
- **Tapping a calendar day now asks what the day is for**, rather than assuming. A date
  means two different things here: a free reminder, or a cake.
- **The four day rule is applied where it belongs.** It is a *baking* lead time, so it
  gates "Order a cake" only. Saving a date is always allowed, including today and dates
  in the past. When a date is too close, the cake option is shown **disabled and
  explained** rather than hidden, so the rule is understood instead of just being absent.
  Boundary tested: today, +1, +3 refused; +4, +5 allowed; `earliestDate()` is exactly +4.
- **"Order a cake" now opens the enquiry overlay in place** instead of navigating to
  `contact.html`, on the Overview action and from the day-choice. It synthesises a hidden
  `[data-enquire]` trigger carrying the date, which is the interface `main.js` already
  exposes.
- "Add a date" on the Occasion Book tab points at `save-date.html` too.

**Roll-forward rule, confirmed by the user 08/08/2026.** A date saved with less than four
full days' notice is **moved forward to its next occurrence**, because there is no time for
this year's reminder run. Implemented in the Occasion Book submit handler, which is now the
single save path for both pages.

- Applies only to occasions that **repeat yearly**. A one-time occasion is never moved: a
  wedding happens on the day it happens, and shifting it a year would put a real event in
  the wrong year. Those save as entered, with no reminders.
- The loop steps a year at a time until the date clears the lead time, so a date left over
  from an earlier year lands on the next real occurrence rather than one still in the past.
- **The customer is always told.** `.form-success__moved` names the occasion, the date they
  asked for, and the date it was saved to. Moving someone's date silently would be worse
  than not moving it.
- Boundary tested: today and +2 roll forward, +4 and +100 are untouched, a wedding is never
  moved, and a rolled date keeps its day and month.

### 08/08/2026 (evening) — The save-a-date form reads like a form now *(Claude Code)*
- **Autofill, properly fixed this time.** See the new §4 entry: the transition trick was
  right but the block sat near the top of `styles.css`, where `.field input` of equal
  specificity and later position replaced its transition. It now lives at the end of the
  file with a doubled pseudo-class. The tell was cream text on a blue background.
- **The form asks plain questions**: "Who is this date for?", "What are we remembering?",
  "Anything else?". Previously "Your name" sat directly above "Their first name", which
  read as a trick question.
- **A signed-in customer is no longer asked for their own name and email.** The account
  page caches `hcl.me` (`{full_name, email}`) on load, the same idea as the existing
  `hcl.firstName` for the nav link, and the form hides that row and shows "Saving as …
  Not you?" instead. Cleared on sign out, global sign out and account deletion.
- **"Remind me every year" is now a question, not a statement.** It was derived from the
  occasion type and only announced. The occasion still sets the default, but the customer
  decides, and the hint states the consequence of whatever the box currently says.
- **`add-circle-member` honours that choice.** It used to derive recurrence server-side and
  ignore the client. Worth noting the second bug found there: the old `default` branch set
  **both** `recurring_yearly` and `is_one_time` to false, so an engagement, baptism,
  retirement or "just because" got no reminder run *and* no anniversary notification. They
  did nothing at all. A non-repeating occasion is now always `is_one_time`.
- **No more sign-in flash.** Both panels start hidden behind a small "One moment..."
  placeholder, because resolving the session is asynchronous and the auth form was
  painting first on every load for someone already signed in.
- "Back to your calendar" now lands on the Calendar tab via `?tab=`, not the Overview.

### 08/08/2026 (late) — Calendar meaning, and two edge functions deployed *(Claude Code)*
- **The gold blooming dot was not the pip.** `.cal__day.is-marked::after` painted a gold
  blooming dot on **every** marked day regardless of what was on it, sitting on top of the
  type-coloured `.cal__pips` underneath. So a saved date bloomed gold exactly like a cake
  order, and the legend described something the grid was not doing. The `::after` is gone;
  `.cal__pips` is now the only marker.
- **Motion now carries the meaning.** A cake order luminates and blooms because it is live
  work in the kitchen. A saved date sits still because it is only a note. Same rule on the
  grid, in the legend, and on the `.pip` in saved-date cards. Under reduced motion the
  order pip keeps a steady halo so it still reads as the louder of the two.
- **`renderAll` now renders each panel in its own guard.** It ran as one straight sequence,
  so a throw anywhere left every list after it blank *with no message at all* — which is
  how the Occasion Book tab came up empty while the calendar was showing that same
  occasion. `loadAccount` got the same treatment, which is what made `?tab=calendar` land
  on the Overview. This is the §4 lesson again, third time in this file.
- `googleCalendarUrl` existed twice again, and the account copy had silently lost the
  yearly repeat. One implementation in `occasions.js`, now with
  `recur=RRULE:FREQ=YEARLY` so a repeating date actually repeats in Google Calendar
  instead of arriving as "Does not repeat".
- Calendar tab eyebrow changed from "Coming up" to "Dates and cakes".

**Deployed to Supabase** (user approved): `delete-account` and `add-circle-member`. Threads
9 and 12 are closed.

**Migration prefix collision caught before pushing.** `supabase migration list` showed
**two** local `0012` entries: Codex's `0012_customer_login_activity` (15:13) and this
session's `0012_normalise_occasion_types` (15:23). This is the exact failure §2 warns
about. Codex's kept `0012` as the earlier file; ours was renamed to
`0014_normalise_occasion_types`. **Nothing was pushed** — see thread 11.

### 08/08/2026 (night) — Stripping back, and the database caught up *(Claude Code)*

**Migrations `0012`, `0013`, `0014` are applied.** Codex confirmed `0012_customer_login_activity`
was final, so all three went in order. The four-day RLS restriction on `circle_members` is
gone, so any date can now be saved, and existing `occasion_type` casing is normalised.
`delete-account` and `add-circle-member` are deployed. Threads 9, 11 and 12 closed.

Removed, all at the user's direction, all because they added confusion rather than use:
- **Add to Google Calendar and the .ics download, everywhere.** The template URL always
  opened Google's own confirm screen, which was friction for a convenience feature.
- **"Order a cake" on saved dates**, both on the calendar and the Occasion Book cards. The
  Occasion Book is a reminder service; an order button on it muddies exactly the line §3
  draws.
- **The day-detail cards under the calendar grid.** With more than a few dates they became
  a second, longer list of the same thing.
- **The "Every year from now on" pop-up.** Ticking a box that already reads "Remind me
  every year" and then confirming it in a modal is the same question twice.

Rebuilt:
- **The Occasion Book is a card grid**, sorted by what happens next, with past dates under
  their own heading. It ran in raw date order, so dates that had already gone sat above the
  next one coming. A recurring date shows its **next** occurrence, computed for display
  only, because the row is not rolled forward until 1 January.
- **Editing a saved date now offers the whole form back** — first name, surname,
  relationship, occasion, date, repeat and notes — in the same order and words as the form
  that created it. It used to show four fields, so a relationship or note was invisible and
  uneditable.
- **Orders are minimal rows, not cards**, with a six-dot progress rail. Two fixes here: the
  Orders tab was using the same card as the Occasion Book so live work looked like a free
  reminder, and the first rebuild was far too heavy. **The stages are read off the admin's
  own `OrderBoard.tsx`** so Hazel and the customer see the same six steps, including
  `deposit_paid` as its own stage called **Confirmed**, which was missing.
- **Today is a ring, not gold text.** Gold text made today look exactly like a day with an
  order on it, which is why the 8th read as an order when nothing was on it. Gold is now
  reserved for orders alone, and "Today" is in the legend. Orders with no agreed date
  cannot sit on a grid of days, so the side panel now says so rather than letting them
  vanish while still being counted.

### 08/08/2026 (late night) — Pictures get a column, and edits get a lock *(Claude Code)*

**Migration `0015` applied. `customer-file` and `add-circle-member` deployed.**

- **Inspiration pictures now live in `circle_members.photo_paths`.** They used to be
  appended to the free-text `notes` column under an "Inspiration pictures:" heading, so
  `notes` held both what the customer wrote and machine data. **This caused a real bug the
  moment the notes field became editable**: the box showed raw storage paths and saving
  wiped them. `0015` adds the column and backfills from the old blob; the notes copy is
  left in place on purpose, and the front end strips it before display.
- **Pictures can be edited on a saved date**: existing ones as signed thumbnails with a
  remove control, plus the same drag-and-drop uploader the Occasion Book uses. Max 6.
  **Removing unlinks, it does not delete from storage** — a misclick should never destroy
  someone's only copy. That leaves orphans, which is the deliberate trade.
- `customer-file` gained `kind: "inspiration"`. The path is never trusted from the
  request: it must already appear in `photo_paths` on one of that customer's own saved
  dates, or anyone could sign anyone else's picture.
- **Editing locks at Confirmed, Baking and Ready, and unlocks again at Completed.** Once
  the cake is collected the record is history and tidying it harms nothing. Applies to both
  saved dates and orders.
- **Customers can now edit their own order details**, which they never could before.
  Column grants are the real boundary, so status, payment and money stay Hazel's alone.
- **`delivery_address` stays editable even while locked**, because an address genuinely
  does change late and it costs nothing. RLS cannot say "these columns but not those", so a
  `before update` trigger does it. **The trigger returns early when `auth.uid()` is null**,
  which is how Hazel and the edge functions (service role) keep moving cakes through their
  stages without being blocked by their own lock.
- Boundary tested: enquiry and quoted stay open, deposit_paid/baking/ready lock, completed
  and cancelled stay open.

Also: the **calendar's** "Next up" card is themed per occasion, grammar fixed so a date
saved for "Myself" reads **"Your Wedding"** rather than "Myself's Wedding", and Orders split
into Current and History tabs.

**On the occasion accents.** The first palette was too muted to see: a wedding's pale ivory
sat on top of the cream text and read as no theme at all. Two lessons. First, "minimal" has
to stay *perceptible* — a 2px edge and a 6px dot in a near-background colour is not subtle,
it is invisible. It now carries on four things at once: the left edge, the label colour, a
lit dot, and a wash that fades out before the middle of the card. Second, **a wedding is
silver, not another gold**, because a gold accent on a gold-and-black page cannot read as a
theme. Accents live in `ACCENTS` in [occasions.js](occasions.js); only "Just because" and
"Other" share gold, deliberately. The wash uses `color-mix` behind an `@supports` guard with
a plain background declared first, so the card is never left transparent.

### 09/08/2026 — Phone calls become service, not consent *(Claude Code)*

**Migration `0016` applied.** Every contact method was opt-in, so a customer could untick
all three and leave Hazel with no way to reach them about a cake they had actually ordered.
Phone calls are now mandatory; email and WhatsApp remain their choice.

- The tick box is gone from the Notifications tab and from sign-up step 3, replaced by a
  card that looks like the others but cannot be pressed. `phone_call_consent` now defaults
  true, existing rows were set true, and **the customer's UPDATE grant on that column was
  revoked**, so the rule holds in the database and not just in the markup.
- **Why this is lawful under POPIA, recorded so nobody has to re-reason it.** These are
  *operational* calls about a cake the customer ordered or a date they asked to be reminded
  of: confirming a detail, agreeing a collection time. That is performance of the service
  they asked for. Direct marketing by phone would still need consent and is not being
  claimed here. [privacy.html](privacy.html) says exactly this, and the account page says it
  in Hazel's words.
- Two display bugs fixed alongside. **The occasion accent was a diagonal gradient**, which
  read as a smudge in one corner rather than a theme; uneven colour looks like a rendering
  fault, so it is a flat even tint now. **A just-uploaded picture showed as a broken image**,
  because `customer-file` only accepted paths already saved in `photo_paths` and a picture
  added while the form is open is not saved yet. It now also accepts a path inside the
  caller's own `<customer id>/` folder, taken from their JWT and never from the request.
  Thumbnails start in a loading state rather than rendering an empty `<img>`.

### 09/08/2026 — Committed and deployed *(Claude Code)*

**Live on https://hazelscakelounge.co.za.** Commits `0cc985c` and `a5754da`, deployed with
`npx vercel --prod --yes --scope 13gumedemp-collabs-projects`, both Ready and aliased.
Verified after the deploy: all pages 200 through the `www.` redirect, `save-date.html`
serving, all eight account tabs present, `phone_call_consent` gone from the markup, and the
new accents and card CSS present in the hashed bundles.

**Deployed from a git worktree, and this is why.** The working tree held Codex's
uncommitted admin work *and* an uncommitted change to `index.html` that removed the loader
subtitle. `vercel --prod` uploads the working directory, so deploying from the repo root
would have shipped another session's unfinished edit. The §3 technique was used:
`git worktree add --detach <tmp> <commit>`, copy `.vercel` in, run the CLI there. Only my
own files were staged; everything under `admin/`, plus `index.html`,
`_shared/email.ts` and `daily-occasion-checker/index.ts`, was left untouched for Codex.

**On the occasion accents, third attempt.** Two failures worth recording, both the same
mistake in different clothes. A diagonal gradient read as a smudge. Then a flat
`color-mix(accent 9%, transparent)` was used, which is simply `rgba(accent, .09)` and is
invisible over a near-black page. Mixing into `var(--bg-2)` rather than into `transparent`
gives an opaque tint that actually shows. **Measure, do not eyeball:** the accents were
then checked by computing the mixed colour's hue and luminance lift, which showed Wedding
resolving to near-neutral grey and Birthday, Retirement and "Just because" sitting within
15 degrees of each other. Every named occasion is now at least 20 degrees from every other,
with "Just because" and "Other" sharing the brand gold deliberately.

### 09/08/2026 Pending activity and sign-up release (Codex)

- Prepared the local recovery-state fix, meaningful admin activity feed, plain-language
  email failure presentation, no-empty daily-check notifications, and returning-customer
  login activity for release. Public Vite build and focused admin TypeScript checks pass;
  the full local Next.js optimiser remains too slow for this OneDrive workspace.
- Local migration state matches remote through `0016`; `0012_customer_login_activity` is
  already applied. The release still needs the `account-login-activity` edge function and
  each edge function that imports the changed shared email helper deployed alongside the
  public and admin Vercel projects.
- Released as commit `9e4fcfa` on 09/08/2026. All nine affected Supabase Edge Functions
  are deployed, including `account-login-activity`. Both Vercel production builds passed,
  and the public site is live through the `hazelscakelounge.co.za` to `www.` redirect while
  the admin redirects unauthenticated visitors to its live sign-in page.

### 09/08/2026 Admin compatibility review for migrations `0014` to `0016` (Codex)

- Updated only the two database-normalised colour-map keys in
  `admin/lib/occasions.ts`: `Baby shower` and `Just because`. Existing ivory-admin colour
  values are unchanged. Local TypeScript transpilation passes and the local admin returns
  its expected unauthenticated `307` redirect to `/login`.
- Confirmed every current admin write path uses the service-role Supabase client, either
  directly through `supabaseAdmin()` or by calling the order-status edge function with the
  service-role key. The new order-lock trigger therefore does not block Hazel's admin work.
- The admin has no customer-facing `phone_call_consent` control, and its customer-detail
  route is presently a placeholder that renders neither `notes` nor `photo_paths`. No
  misleading consent control or raw legacy inspiration-storage paths require a change.
  Verified locally only. No deployment was performed.

---

## 6. Open threads

| # | Item | Detail |
|---|---|---|
| 1 | Unshipped changes | `c26b088` responsive hardening, the recovery-state sign-up fix, and the activity-feed cleanup are local or on `main` but not deployed. Include the intended set in the next deploy the user asks for. |
| 2 | One-time Occasion Book reminders | `daily-occasion-checker` sends customer reminders only for *recurring* events. One-time events are saved but skip the reminder sequence. Do not promise full coverage for one-time dates until this is fixed and deployed. |
| 3 | Test account cleanup | `hazelscakelounge+test@gmail.com`, auth user `fa766594-5264-4449-b5e7-a8bedab8d527`, created 29/07/2026 to verify the sign-up flow. Delete the auth user and its `customers` row once the user confirms. |
| 4 | Unreferenced images | `work-ed-10`, `-17`, `-19`, `-22`, `-23` are no longer referenced but still ship in `public/images`. Delete only if the user confirms. |
| 5 | Resend key hygiene | The rejected credential was replaced in both Edge Functions and Auth SMTP on 08/08/2026. The new sending key was also supplied in chat, so rotate it again directly from the correct Resend profile when practical and update the same two Supabase locations. Do not paste the replacement into chat. |
| 6 | Email delivery unverified end to end | Sender-domain verification is now correct and a direct API send succeeded, but the full account-creation email path was never exercised against a real new account. |
| 7 | Publish the Google OAuth consent screen | Completed on 08/08/2026. The app is In production; no Supabase change was needed. |
| 8 | `customers.email` goes stale after an email change | Changing the sign-in email updates the auth user but nothing writes the new address back to the `customers` row, so reminders and invoices keep going to the old one. Found 08/08/2026 while building the Sign in tab; `account.js` now keeps a separate `authEmail` so password checks are not affected, but the write-back still needs doing (a trigger on `auth.users`, or an update alongside `verifyOtp`). |
| 12 | ~~`add-circle-member` not deployed~~ | **Deployed 08/08/2026.** Closed. |
| 11 | ~~Migrations `0012`, `0013`, `0014` not applied~~ | **Applied 08/08/2026** after Codex confirmed `0012` was final. Closed. |
| 10 | ~~Two save-a-date forms, one column~~ Closed 08/08/2026 | The Occasion Book and the account calendar sheet write `circle_members.occasion_type` from different lists with different casing, and capture different fields. Unify the list into one shared constant, add the "Other" free-text follow-up to the sheet, and decide which fields are genuinely required. See the 08/08/2026 entry. |
| 9 | ~~`delete-account` is not deployed~~ | **Deployed 08/08/2026.** Closed. |

### Handoff: publish the Google OAuth consent screen *(for Codex, opened 08/08/2026)*

**Goal.** Move the `hazels-cake-lounge-auth` OAuth consent screen from *Testing* to
*In production*, so customer Google sign-in is not degraded.

**Why it matters.** While an External app sits in Testing:
- refresh tokens expire after **7 days**, so signed-in customers get silently logged out;
- only explicitly listed test users can sign in, capped at 100;
- everyone else sees the "Google hasn't verified this app" interstitial.

**Verified state as of 08/08/2026:**
- gcloud CLI is authenticated as `13gumedemp@gmail.com`; active project is
  `hazels-cake-lounge-auth` (number `732761854674`).
- The project has only default APIs enabled. No OAuth or IAP API is enabled on it.
- `account.js` calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`
  and passes **no `scopes` option**, so Supabase's defaults apply: `email`, `profile`,
  `openid`. These are **non-sensitive scopes**, which means publishing needs **no Google
  verification review** — it takes effect immediately, with no video, no privacy-policy
  audit and no multi-week wait.
- The current publishing status was *not* determined. Confirm it in the Console first;
  the app may already be published.

**This cannot be automated — by Codex or anything else.** There is no public API to set
the publishing status of an External consent screen. The old `gcloud alpha iap
oauth-brands` path never supported it for External apps anyway, and Google
**permanently shut the IAP OAuth Admin APIs down on 19/03/2026** — the CLI now returns a
deprecation notice confirming this. The publish action is a Console-only, human click.

**Human steps (about two minutes):**
1. Open https://console.cloud.google.com/auth/audience?project=hazels-cake-lounge-auth
2. If "Publishing status" reads *Testing*, click **Publish app** and confirm.
3. Expect no verification prompt. If one appears, stop — it means a sensitive scope has
   been added somewhere and the cause must be found before proceeding.

**What Codex can usefully do around it:**
- Confirm the OAuth client's authorised redirect URI is exactly
  `https://qgzpoyyijafblzfiyhoc.supabase.co/auth/v1/callback` and its origin is
  `https://hazelscakelounge.co.za`.
- After the click, verify end to end on localhost: `npm run dev`, open
  http://localhost:5173/account.html, start Google sign-in and confirm the consent screen
  no longer shows the unverified-app warning.
- Note that `localhost` must be an authorised JavaScript origin for that local test, or
  test against production instead.
- Do **not** enable `iap.googleapis.com`; it is not needed and the API is dead.
