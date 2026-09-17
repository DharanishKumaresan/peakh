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

Apply the migration once per new local database. The preview runs at http://localhost:5173. On this Windows host, if the npm shim fails, invoke `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"` in place of `npm`.

## Features

- Responsive record board with strength/endurance filters and light/dark themes.
- Quick logging with activity, value, and date; custom activity creation with unit and record direction.
- Editable goals, progress graphs, a 26-week logging heatmap, and chronological log deltas.
- Lower-is-better timing records and higher-is-better strength records.
- Friends leaderboard with manually entered friend records. This is not a live social network; there are no invitations or automatic friend syncing.
- Example data is clearly labeled. Start fresh removes only example logs and friends.
- Records persist in D1. Hosted identity uses the Sites authenticated user; local anonymous sessions use a secure opaque HttpOnly cookie. Clearing this cookie creates a new anonymous board. Theme preference alone uses localStorage.
- Server validation, board isolation, origin checks, and recoverable save errors.

## Verification

```sh
node --test tests/records.test.mjs
node tests/api-smoke.mjs
npx tsc --noEmit
npm run build
```

The API smoke check requires the local preview and an initialized database. It uses isolated temporary test boards and restores its test records. Tests cover PR direction, time parsing, same-day ordering, persistence, invalid values/dates, separate boards, and cross-origin writes.

Source: `app/peakh.tsx` (UI), `app/globals.css` (design), `app/records.ts` (record logic), `app/api/records/route.ts` (storage), and `db/schema.ts` (schema).
