# Company Tasks

Company Tasks is a simple shared task list for a small company. It keeps the Microsoft To Do-like workflow intentionally focused: create, assign, work, confirm completion, and retain the history.

## Current app

The first screen is fully usable without external credentials. It includes seeded demo users and tasks, responsive navigation, search, task creation, optional due dates, editing, completion confirmation, completed-task history, soft deletion, and local persistence. A service worker and web app manifest make the app installable as a PWA.

The local persistence layer is intentionally isolated in `app/page.tsx` so it can be replaced by the Supabase client without changing the UI model. The production database contract is included in `supabase/migrations/0001_company_tasks.sql`.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Other checks are available with `npm run test`, `npm run test:e2e`, `npm run typecheck`, and `npm run build`.

## Supabase setup

1. Create a Supabase project and enable email/password authentication.
2. Copy `.env.example` to `.env.local` and fill in the project URL and browser-safe anon key.
3. Run the migration in the Supabase SQL editor or with the Supabase CLI.
4. Create an organization and profiles for the Auth users. Each profile's `id` must match its `auth.users.id`.
5. Keep service-role credentials server-side only; never put them in `.env.local` values prefixed with `NEXT_PUBLIC_`.

The migration enables RLS and scopes all organization data through the authenticated user's active profile. Tasks are soft-deleted and completion stores both the actor and exact UTC timestamp.

The browser client is available in `lib/supabase.ts` and deliberately returns `null` when the environment variables are absent, so local demo mode remains available while the project is being configured.

## Deployment

To deploy with Vercel:

1. Import `github.com/kirieirik/Letswork` into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project Settings → Environment Variables for Production, Preview, and Development as appropriate.
3. Deploy the `main` branch.
4. Add the deployed URL to Supabase → Authentication → URL Configuration → Site URL and Redirect URLs.

Run the Supabase migration before inviting users. The app is a static-compatible Next.js App Router application and can also be self-hosted with `npm run build && npm start`.

Before a release, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`. The Playwright suite starts a production-style local server and uses `/?demo=1`, so it does not touch the live Supabase workspace.

## Structure

- `app/page.tsx` - responsive task manager and interaction flows
- `app/globals.css` - visual system and desktop/mobile layout
- `app/layout.tsx` - document metadata and PWA manifest registration
- `public/manifest.webmanifest` and `public/sw.js` - install/offline shell
- `supabase/migrations/0001_company_tasks.sql` - schema, indexes, realtime, and RLS# Letswork