# Hazel's Cake Lounge

## Before you do anything

Read [PROJECT-MEMORY.md](PROJECT-MEMORY.md). It holds the architecture, the standing
design and business rules, the bugs that have already cost time, the full history, and the
open threads.

## Before you report work as done

Append a dated entry to §5 of [PROJECT-MEMORY.md](PROJECT-MEMORY.md) covering what
changed, why, and anything left open. This applies to every session and every tool.
Update §6 when a thread opens or closes.

## Verify on localhost, do not deploy

Vercel's free plan allows 100 deployments per project per day and this account has already
been blocked by `api-deployments-free-per-day`. So:

- Public site: `npm run dev` → http://localhost:5173
- Production-equivalent: `npm run build` then `npm run preview`
- Admin: `cd admin && npm run dev` → http://localhost:3000

Commit and push to `main` as usual — pushing does not deploy here, deploys are CLI-only.
**Only run a Vercel deploy when the user explicitly asks for one**, and batch changes into
it. The command and the alias check are in §3 of PROJECT-MEMORY.md.

## Never

- Write secrets into the repository or into memory files.
- Reuse a Supabase migration version prefix.
- Add a public page without adding it to `rollupOptions.input` in
  [vite.config.js](vite.config.js) — it will silently not build.
- Label the account nav link "My Account". See the naming rule in PROJECT-MEMORY.md §3.
