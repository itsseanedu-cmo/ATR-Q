# Atherton Open Play

A mobile-first pickleball open-play manager for The Atherton Pickleball Club. The original supplied crest is included, with navy `#0B2E63`, white, pickleball yellow `#E8FF4D`, serif headings, and sans serif controls.

## Use

- The home page opens a 24-player, two-court demo saved on the current device. Unlock its organizer controls with PIN **1234**.
- **Start a live session** creates a durable shared session. Choose a private four-digit organizer PIN. Session creation works without a ChatGPT account. Optionally include the demo lineup; otherwise the session starts empty.
- Save the organizer URL. PIN login works for additional organizing devices. **Player QR code** shares a session-specific read-only URL. Players do not need to sign in.
- Shared sessions poll the server every 2.5 seconds. The board caches its last received state and visibly reports a lost connection. Organizer changes are blocked while disconnected.
- Check in names individually or paste names separated by newlines, commas, or semicolons. Skill level is optional. Waiting players can take a break without losing match history.
- End games with optional scores. Use **End both games**, then **Fill all open courts** for batch assignment. Use a single court's **Start game** for staggered games. Swapping players keeps the existing clock running.
- Settings include club name, session title, logo upload, primary/accent hex colors, court names, low-ratio scoring, PIN rotation, demo loading, simulated rounds, and session reset.
- The player board offers courtside QR mode, full screen, live clocks, lineups, waits, games played, and unique players met. The fairness page shows partner and opponent matrices. History supports CSV export.

## Pacing and fair rotation

The organizer can toggle a 13-minute game cap in Settings. It turns on automatically at 22 active players. With the cap off, clocks show elapsed play time. With the cap on, at three minutes remaining an amber warning appears; at zero the court turns red and calls for rotation regardless of score. A chime can be enabled. An organizer ends the game; timeout does not silently clear a court. Clocks persist as absolute timestamps and survive reloads.

At nine or more active players per court, games end at 11, sudden death applies at 10–10, and clock pausing is blocked. Below that ratio, win-by-two can be enabled. Paused players are excluded from the ratio and wait protection.

Wait protection counts **paired rounds**, not every individual court finish: one round comprises two court starts, whether started together or separately. At 24 active players, eight play per round and everyone can play once every three rounds. Active check-in is capped at 12 players per court because a tighter ceiling is infeasible above that capacity. A returning player needs an available active slot.

The planner prioritizes fewest rotation-adjusted games and longest wait. It locks due players and the four oldest waits into a 12-player candidate pool, exhaustively scores four-player groups and all three team splits, then finds the lowest combined disjoint two-court assignment. Repeat partners cost 100 per encounter; repeat opponents cost 35. Each minute waited and missed round contributes a 50-point priority bonus. Shuffle changes tie-breaking while preserving priority.

Actual GP counts completed games. Late arrivals start at zero GP and receive separate rotation credit so they can join the current cycle without displacing every established player; returning players receive credit for time spent on break. Their real played-game totals are never inflated. Manual swaps, breaks, and irregular early finishes may change preview lineups. Up Next is recalculated after every change.

## Data and security

Live state, clock timestamps, history, branding, and counters are stored in D1; the local demo uses localStorage. Public session IDs are random UUIDs. Public responses contain only board data. Server-side mutations require a random bearer token, which is stored hashed on the server and in sessionStorage on the organizer device. Tokens expire after 12 hours; PIN rotation revokes other organizer tokens. PINs are salted with PBKDF2-SHA256 (100,000 iterations), with an eight-attempt, 15-minute login limit. Revisions prevent concurrent edits from overwriting one another. All SQL is parameterized. Uploaded logos are restricted to bounded PNG, JPG, or WebP data URLs.

The public player link intentionally reveals player display names and session stats to anyone with that link. Avoid using sensitive personal information as display names.

## Develop and validate

Node 22.13+ is required. Keep the Sites/Vinext build integration and `.openai/hosting.json` identity intact.

```sh
npm ci
npm run dev -- --port 5173 --hostname 127.0.0.1
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types scripts/test-engine.mjs
npm run build
```

Generate schema migrations with `npm run db:generate`. Use the Sites build and publication workflow to apply hosted migrations. Local D1 is separate; apply `drizzle/0000_remarkable_roxanne_simpson.sql` using Wrangler with the generated `dist/server/wrangler.json` and `.wrangler/state` persistence directory.

Validation covers 90 paired rounds, game-count balance, the two-round ceiling, unique assignments, due-player priority, history penalties, scoring, timers, capacity, swaps, and input validation. An additional 180 uneven single-court turnovers and a QR encode/decode round trip were checked during implementation. Live API checks cover anonymous read, anonymous session creation, incorrect PIN rejection, unauthorized mutation rejection, optimistic concurrency, and no credential leakage in public responses. Browser QA covered desktop, tablet, 390px and 320px mobile layouts, score entry, read-only controls, warnings, timeout, and courtside QR mode.

QR generation uses the MIT-licensed qrcode-generator by Kazuhiko Arase, adapted from its UMD distribution into an ES module. License attribution is retained in `lib/qr-generator.js`.

## Project structure

- `app/` — application pages, session API routes, and global styles.
- `components/` — organizer and player board UI, forms, standings, and reusable controls.
- `lib/` — queue engine, matchmaking modes, player profiles, QR generation, and API helpers.
- `db/` and `drizzle/` — database schema and schema migrations; no live database records are included.
- `public/` — club logos, favicon, and the approved Easter egg photo asset.
- `scripts/` — development/build helpers and queue behavior checks.
- `worker/` — Worker entry point for the Sites/Vinext application.
- `vendor/` — vendored styling assets and their license notices.
- `package.json` and `package-lock.json` — dependency declarations and reproducible npm install lockfile.
- `.openai/hosting.json`, `vite.config.ts`, `tsconfig.json`, and `drizzle.config.ts` — Site, build, TypeScript, and schema configuration.
