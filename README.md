# peakh

A minimal React app for personal activity records. Vercel runs Next.js; Supabase provides email/password authentication, private records, friend sharing, and photo storage. The original Cloudflare/Vinext files remain for reference.

## Vercel / Supabase deployment

```sh
npm ci
npm run dev:vercel
npm run build:vercel
node tests/supabase-migration.mjs
vercel --prod
```

The Next.js development server runs on port 5174. Apply `supabase/migrations/202609230001_peakh.sql` once to a new Supabase project; it was applied to the Peakh project on September 24, 2026. Do not rerun it on that project. The SQL test uses an isolated in-memory PostgreSQL instance and does not modify production data.

The public project URL and publishable key live in `lib/supabase/config.ts` and may be overridden with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never use a service-role key in the browser. Supabase Auth must have the production Site URL and its exact `/auth/callback` URL in the redirect allowlist. Email confirmation remains enabled.

The public `/donate` page displays the UPI recipient `dharanishpk1939-1@okhdfcbank`, a QR code, a copy option, and an app-opening link. The current personal UPI ID has a reported GPay intent rejection, including for a ₹1 payment; restoring the link does not resolve that restriction. A supported, verified merchant payment integration is required before treating the direct app flow as working. Supporters can copy the UPI ID into their payment app or scan the QR code from another device. Set `PEAKH_UPI_ID` and `PEAKH_UPI_PAYEE_NAME` to override the recipient ID and displayed name; changing these values alone does not establish merchant verification. UPI payments are made in INR; the app does not handle payment credentials or claim that a payment succeeded.

Records and photos now use Supabase, not the legacy D1/R2 backend described below. Existing Cloudflare records are not automatically transferred. Authentication now uses real Supabase accounts; legacy proxy identity headers are ignored. The tests in `tests/api-smoke.mjs` and `tests/photo-api.mjs` target the old local Cloudflare worker and are not Vercel integration tests.

## Legacy Cloudflare development (reference)

Use Node.js 22.13+.

```sh
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_smart_white_queen.sql
npm run dev
```

Apply each SQL migration in `drizzle/` in order, once per local database, including `0001_classy_power_man.sql`. The preview runs at http://localhost:5173. Its sign-in uses a local test account. On this Windows host, if the npm shim fails, invoke `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"` in place of `npm`.

## Features

- Minimal responsive PR board with editable goal labels, thin progress bars, and light/dark themes.
- A top-right navigation menu contains My records, Friends and Profile. The homepage uses a single icon to switch between grid and row layouts and remembers the choice on this device. New activities remain available in the orange + log flow.
- Profile photos have a local square preview before saving. JPG, PNG and WebP inputs up to 10 MB are resized to 512px JPEGs; R2 holds the photo and D1 records ownership. Photos are readable only by the owner and accepted friends, and can be replaced or removed from Profile.
- Quick logging with activity, value, and date; custom activity creation with unit and record direction.
- Editable goals, progress graphs, a 26-week logging heatmap, and chronological log deltas.
- Lower-is-better timing records and higher-is-better strength records.
- Real account-based friend requests via private friend codes and invite links. Acceptance enables mutual access to profiles, progress charts, goals and activity history. Removing a friend revokes access.
- Leaderboards derive from saved real logs, refresh immediately after your saves, and poll every 10 seconds while Friends is visible. Matching requires the same activity, event, units and scoring direction. Equal PRs share a rank.
- Example data is clearly labeled. Start fresh removes only example logs and friends.
- Records persist in D1 under the authenticated Sites identity. New accounts start empty. Existing anonymous records migrate into a new account when its original browser cookie is present. Sample logs are excluded from shared profiles and rankings. Theme preference alone uses localStorage.
- Server validation, board isolation, origin checks, friend-only reads, and versioned saves that prevent overwriting newer records from another device.

## Verification

```sh
node --test tests/records.test.mjs
node --test tests/social.test.mjs
node tests/photo-api.mjs
node tests/api-smoke.mjs
npx tsc --noEmit
npm run build
```

The API smoke check requires a built local worker at 127.0.0.1:5180 and initialized tables. Start with `npm run start -- --port 5180`. It creates uniquely named test accounts in the local database and refuses remote targets. Tests exercise consent, profile authorization, real PR updates, goal persistence, invalid dates, stale saves and access revocation. The dev preview strips identity headers; the built local worker is used to simulate separate identities that the Sites proxy supplies in production. A Wrangler preview proxy bug can interrupt the request following a rejected cross-origin POST, so that check runs last.

Source: `app/peakh.tsx` (UI), `app/globals.css` (design), `app/records.ts` (record logic), `app/api/records/route.ts` (storage), and `db/schema.ts` (schema).
