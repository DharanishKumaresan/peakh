# peakh

A minimal React app for personal activity records. Built with functional components, hooks, Recharts, CSS variables, and a Cloudflare D1 database. The Next-compatible Vinext runtime serves the React app and API.

## Local development

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
