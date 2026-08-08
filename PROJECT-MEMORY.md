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
`index` · `menu` · `work` · `story` · `reviews` · `contact` · `occasion-book` ·
`messaging-terms` · `terms` · `privacy` · `account`

### Supabase migrations (all applied)
`0001_initial_schema` · `0002_cron_daily_occasion_checker` · `0003_whatsapp_reminders_due` ·
`0004_circle_model` · `0005_orders_completed_at` · `0006_retire_occasions` ·
`0007_customer_accounts` · `0008_social_login_hardening` · `0009_account_creation_alerts` ·
`0010_split_customer_name` · `0011_backfill_customer_auth_links`

**Never reuse a migration version prefix.** A duplicate `0009` already caused a failure
once and had to be renamed to `0010`.

### Edge functions
`_shared` · `account-created-alert` · `add-circle-member` · `customer-file` ·
`daily-occasion-checker` · `enquiry-followup-check` · `generate-invoice` ·
`generate-memory-card` · `process-enquiry` · `request-callback` · `send-circle-followup` ·
`send-email` · `update-order-status`

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
- Mobile layouts must be explicitly verified, not assumed.
- `--liquid-button-fill` is `0px` site-wide: buttons rest empty and only flood gold on
  hover or tap.

### Business rules

- Minimum lead time is **four full calendar days** on every cake enquiry and Occasion
  Book date input.
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
  it produces an empty dropdown. The Occasion Book date sheet keeps a native `<select>`
  for this reason.
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

---

## 6. Open threads

| # | Item | Detail |
|---|---|---|
| 1 | `c26b088` is unshipped | The responsive hardening commit is on `main` but not deployed. Include it in the next deploy the user asks for. |
| 2 | One-time Occasion Book reminders | `daily-occasion-checker` sends customer reminders only for *recurring* events. One-time events are saved but skip the reminder sequence. Do not promise full coverage for one-time dates until this is fixed and deployed. |
| 3 | Test account cleanup | `hazelscakelounge+test@gmail.com`, auth user `fa766594-5264-4449-b5e7-a8bedab8d527`, created 29/07/2026 to verify the sign-up flow. Delete the auth user and its `customers` row once the user confirms. |
| 4 | Unreferenced images | `work-ed-10`, `-17`, `-19`, `-22`, `-23` are no longer referenced but still ship in `public/images`. Delete only if the user confirms. |
| 5 | Resend key rotation | A live Resend send-only API key was pasted into a chat on 29/07/2026. Recommend rotating it. |
| 6 | Email delivery unverified end to end | Sender-domain verification is now correct and a direct API send succeeded, but the full account-creation email path was never exercised against a real new account. |
