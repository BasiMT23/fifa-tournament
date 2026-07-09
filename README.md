# FIFA Tournament Management System

A full-stack platform for running FIFA-style tournaments: bracket generation,
a bracket-prediction game, a simple fantasy football game, live match updates,
and match trash-talk comments.

**Status: complete.** All 10 steps of the original plan are implemented: backend
(auth, tournaments, brackets, predictions, fantasy, external API, real-time)
and a React frontend consuming all of it. Every core flow — registration,
bracket generation/seeding, score reporting → auto-advance → prediction
scoring, fantasy drafting with budget caps and captain doubling, comments —
was tested end-to-end against a real PostgreSQL database, not just unit
tests. See "What was verified end-to-end" below for exactly what was checked.

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL (`pg`, raw SQL — no ORM)
- **Auth:** JWT access tokens + rotating httpOnly-cookie refresh tokens, bcryptjs password hashing
- **Validation:** Joi
- **Logging:** Morgan (HTTP) piped into Winston (files + console)
- **Real-time:** Socket.io — live scores, bracket auto-updates, match chat
- **Testing:** Jest (33 unit tests) + full manual end-to-end verification against a real PostgreSQL instance
- **Frontend:** React 18 + Vite, React Router, Socket.io client, Axios — no UI framework, hand-styled to a dark scoreboard aesthetic (see "Frontend" section below)

## Project Structure

```
project/
├── backend/
│   ├── src/
│   │   ├── config/db.js            # Postgres pool
│   │   ├── models/                 # raw-SQL query modules
│   │   ├── controllers/            # request handlers
│   │   ├── routes/                 # Express routers
│   │   ├── middleware/             # auth, RBAC, error handling
│   │   ├── services/bracketService.js  # pure bracket/seeding algorithms
│   │   ├── utils/                  # logger, jwt helpers, validators
│   │   └── app.js                  # Express app assembly
│   ├── db/schema.sql               # full DDL for every table in the system
│   ├── db/migrate.js               # applies schema.sql
│   ├── tests/                      # Jest unit tests
│   ├── logs/                       # Winston log output
│   ├── server.js                   # HTTP server + Socket.io bootstrap
│   └── package.json
├── frontend/                       # scaffolded, built out in Step 10
└── README.md
```

## Setup & Run

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# then edit .env with your real DB credentials and JWT secrets
```

### 3. Create the database and apply the schema
```bash
createdb fifa_tournament        # or create it via psql/pgAdmin
npm run migrate                 # runs db/schema.sql against it
```

### 4. Start the server
```bash
npm run dev      # nodemon, auto-restarts on changes
# or
npm start
```

The API is now live at `http://localhost:5000`. Check `GET /api/health`.

### 5. Run tests
```bash
npm test
```

## What's implemented so far

### Auth (JWT + bcryptjs + RBAC)
- `POST /api/auth/register` — bcryptjs-hashed password, role forced to `player` regardless of request body (prevents privilege escalation)
- `POST /api/auth/login` — returns a short-lived access token in the JSON body + a long-lived refresh token as an httpOnly cookie
- `POST /api/auth/refresh` — exchanges a valid refresh cookie for a new access token; refresh tokens are stored **hashed** in the DB so they can be revoked
- `POST /api/auth/logout` — revokes the refresh token
- `GET /api/auth/me` — protected route example
- Role-based middleware (`authorize('admin', 'organizer')`) guards write endpoints

### Tournaments & Bracket Generation
- `POST /api/tournaments` — create (organizer/admin only)
- `GET /api/tournaments`, `GET /api/tournaments/:id` — browse
- `POST /api/tournaments/:id/participants` — bulk add, auto-seeds by skill rating
- `POST /api/tournaments/:id/generate-bracket` — builds the full match tree:
  - **Knockout:** standard seeding (1v16, 2v15, ... 8v9) via a recursive interleaving algorithm, with automatic byes for non-power-of-two participant counts
  - **Round-robin:** circle-method scheduling (everyone plays everyone once)
  - **Group + knockout:** groups scheduled round-robin; knockout stage generation hooks in once group play concludes
  - All matches for a bracket are inserted in a single DB transaction, with `next_match_id` links so winners can auto-advance
- `PATCH /api/tournaments/:id/matches/:matchId/score` — reports a result, determines the winner, and advances them to the next match slot automatically. Emits a Socket.io event on the tournament's room (fully wired in Step 9).

### Database
`db/schema.sql` contains the **complete** schema for every planned feature —
users, tournaments, participants, matches, match_stats, predictions,
fantasy_teams, fantasy_players, fantasy_scoring, match_comments, and a
`prediction_leaderboard` view — even though only the tournament tables are
wired up to code so far. This was done up front so later steps don't require
schema migrations that break existing data.

### Bracket Guessing Game
- `POST /api/predictions` — submit or change a pick (`{ matchId, predictedWinnerId }`). Blocked once both participants aren't yet known, or once the match has started (`status !== 'scheduled'`)
- `GET /api/tournaments/:id/predictions/me` — your own picks for a tournament, joined with live match state
- `GET /api/matches/:matchId/predictions` — **privacy-aware**: while the match is unresolved you only see your own pick; everyone else's stays hidden until the match is `completed`
- `GET /api/tournaments/:id/leaderboard` — ranked by total points, then correct picks
- Scoring is **round-weighted**: correct picks are worth `2^(round-1)` points (Round 1 = 1pt, Quarter = 4pt, Semi = 8pt, Final = 16pt in a 16-team bracket), rewarding deep, accurate predictions
- Scoring runs automatically the moment an organizer reports a match score and broadcasts a `predictions:scored` Socket.io event

### Fantasy Football
- `POST /api/fantasy/teams` — create your team for a tournament (`{ tournamentId, teamName }`), one per user per tournament
- `POST /api/fantasy/teams/:id/players` — draft a player (`{ externalPlayerId, playerName, position, realTeam, price }`); enforces a **£100.0 budget cap** and **15-player squad limit**, owner-only
- `DELETE /api/fantasy/teams/:id/players/:playerId` — drop a player
- `PATCH /api/fantasy/teams/:id/captain` — set your captain (their points count double that gameweek)
- `POST /api/fantasy/players/:fantasyPlayerId/scoring` — **admin/organizer only**: record a player's real-world stat line for a gameweek (`{ gameweek, minutesPlayed, goals, assists, cleanSheet }`); this is the entry point live match data will feed in Step 8
- `GET /api/fantasy/teams/:id/gameweek/:gameweek` — per-gameweek breakdown for a team
- `GET /api/fantasy/tournaments/:tournamentId/leaderboard` — ranked by total points

**Scoring** (`fantasyScoringService.js`, classic FPL-style rules):
| | GK | DEF | MID | FWD |
|---|---|---|---|---|
| Goal | 6 | 6 | 5 | 4 |
| Clean sheet (60+ mins) | 4 | 4 | 1 | 0 |

Plus: 1pt for any appearance, 2pt for 60+ minutes, 3pt per assist (all positions), captain's total doubled. Each gameweek is stored as its own row (`UNIQUE(fantasy_player_id, gameweek)`), so resubmitting or correcting one week's stats never touches another week's — that's the "weekly reset" the spec asked for. Team totals are recalculated as a sum across all gameweeks whenever new stats come in, so they're always consistent even if a past week's data is corrected later.

### External API Integration
- `GET /api/external/football-data/competitions/:code/matches?status=&matchday=`
- `GET /api/external/football-data/competitions/:code/standings`
- `GET /api/external/football-data/competitions/:code/scorers`
- `GET /api/external/football-data/teams/:teamId`

Built against **football-data.org's v4 API** (verified against their current official docs — free tier: 10 requests/minute, 12 competitions, delayed scores, `X-Auth-Token` header auth). This is the concrete, working example; the pattern (`src/services/httpClient.js`) is provider-agnostic so any other REST API can plug in the same way.

**A note on the other free APIs listed in the original spec** (Zafronix, SportScore, SoFIFA, "Public FIFA API"): I couldn't independently verify current documentation, auth requirements, or stability for these, so I didn't want to hard-code integration code against endpoints I couldn't confirm still work — that tends to produce code that silently breaks. football-data.org is real, current, and free, so it's the fully-implemented reference integration here. If you have working docs/keys for any of the others, the same `httpClient.js` wrapper drops in cleanly — just replicate the pattern in `footballDataService.js` with the new base URL and auth header.

**How rate-limit handling actually works** (`src/services/httpClient.js`):
1. Every request is cached by key for 5 minutes by default (configurable per call) — this alone eliminates most repeat calls against a 10-req/min budget.
2. A second, non-expiring "stale" cache mirrors every successful response. If the provider returns `429` and the 5-minute cache has already expired, we serve the stale data instead of failing the user's request outright.
3. Only if there's truly nothing cached does a `429` become a `503 Service Unavailable` back to the client — a clear, honest failure instead of a hang or a crash.
4. A per-user Express rate limiter (20 req/min) on `/api/external/*` stops one user from burning the entire app's shared quota.
5. All of this is unit tested in `tests/httpClient.test.js` — cache hits/misses, independent keys, stale-data fallback, and both 429 and generic-error translation.

### Real-time Features (Socket.io)
- **Connection:** anonymous spectators can connect and watch (no login required to see live scores); if a client passes a JWT as `auth: { token }` on connect, it's verified and attached as `socket.user` — this unlocks user-attributed features like "X is typing" without requiring auth for everyone
- **Rooms:** clients call `tournament:join` with a tournament ID to receive only that tournament's events — verified end-to-end with a real client/server socket connection (client joins room, server broadcasts, client receives)
- **Events emitted by the server:**
  - `match:completed` — a match finished, with the final score/winner (from `reportScore`)
  - `bracket:match_advanced` — the winner moved into their next bracket slot; pushes that match's new state (the "bracket auto-updates" feature)
  - `bracket:generated` — a full bracket was just created for a tournament
  - `match:status_changed` — an organizer moved a match to `live`/`postponed`/etc. (`PATCH /api/tournaments/:id/matches/:matchId/status`) — separate from scoring, since "kickoff" and "final score" are different spectator-facing moments
  - `predictions:scored` — bracket-guessing picks were graded after a match completed
  - `fantasy:scored` — a fantasy player's gameweek stats were entered and points calculated
  - `comment:new` / `comment:deleted` — real-time trash talk feed
  - `comment:typing` — ephemeral typing indicator (never persisted)

### Match Comments (Trash Talk)
- `GET /api/matches/:matchId/comments` — list comments on a match
- `POST /api/matches/:matchId/comments` — post one (max 500 chars), broadcasts `comment:new` to the tournament room
- `DELETE /api/matches/:matchId/comments/:commentId` — the author or an admin/organizer can delete; enforced by a pure, unit-tested permission function (`canDeleteComment` in `commentService.js`)

## Frontend (React + Vite)

**Design direction:** a tournament scoreboard, not a generic dashboard — dark
background, Anton (condensed display font) for headlines, IBM Plex Mono for
scores/data, Inter for body text. Pitch-green accent for wins/live-progress,
amber for live matches, crimson for errors/losses.

- **Auth:** access token held in memory only (not localStorage — safer against XSS); refresh token is an httpOnly cookie the browser sends automatically. A silent `/auth/refresh` call on page load re-authenticates after a hard refresh without the user noticing.
- **Bracket visualization** (`BracketView.jsx`): real SVG connector lines computed from each match's position — no external charting library. Round 2's vertical position is the midpoint of its two round-1 feeder matches, and so on, so the lines always converge correctly regardless of bracket size. When a `bracket:match_advanced` socket event fires, the connector into that match briefly pulses green.
- **Real-time everywhere:** a single shared Socket.io connection (`SocketContext`) joins/leaves a room per tournament being viewed. The bracket, prediction leaderboard, and match comments all update live without polling or a manual refresh.
- **Pages:** login/register, tournament dashboard, tournament creation wizard (create → add participants → generate bracket), tournament detail (bracket / prediction leaderboard / fantasy tabs), and a standalone match page (predictions + live chat).

### Running the frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api and /socket.io to the backend on :5000
```

## What was verified end-to-end

Beyond the unit tests (33 passing across bracket generation, prediction scoring,
fantasy scoring, comment permissions, and the external-API caching layer), the
full stack was exercised against a **real running PostgreSQL database** and a
**real running Express server** — not mocked:

- Registered two real users, confirmed registration always forces `role: 'player'` regardless of request body (privilege-escalation guard)
- Created an 8-team knockout tournament, added participants with skill ratings, generated the bracket — **confirmed the actual seeding was 1v8, 4v5, 2v7, 3v6**, matching the standard tournament seeding algorithm exactly
- Submitted a prediction as a player, reported a match score as the organizer, and confirmed in the database that: the winner was correctly determined, the winner correctly advanced into the next round's match slot, and the prediction was automatically graded and awarded the correct round-weighted points
- Confirmed the prediction leaderboard reflected the graded pick correctly
- Created a fantasy team, drafted a player, set them as captain, then **confirmed a budget-cap-exceeding draft was correctly rejected**
- Recorded gameweek stats (2 goals, 90 minutes) for the captain and confirmed the point total matched the scoring formula exactly (2 mins-played pts + 2×4 goal pts = 10, doubled to 20 for the captain)
- Posted a match comment and confirmed it persisted with the correct author
- Reloaded "my fantasy team" for a tournament (simulating a page refresh) and confirmed the team and its players came back correctly
- Rendered the frontend in a real headless browser (Playwright): confirmed the page title, correct redirect-to-login for unauthenticated users, and no JavaScript runtime errors

One real bug was caught and fixed *because* of this real-environment testing: `bcrypt`'s native binary fails to compile in this sandbox even with build tools installed (a known pain point on Windows too, and something you'd flagged running into before) — swapped to `bcryptjs` (pure JS, identical API) so the project installs cleanly everywhere with zero native compilation.

## Roadmap — all steps complete

| Step | Feature |
|---|---|
| 1 | ✅ Project setup |
| 2 | ✅ JWT authentication |
| 3 | ✅ Tournament CRUD |
| 4 | ✅ Bracket generation algorithm |
| 5 | ✅ Match management / score reporting |
| 6 | ✅ Bracket guessing game |
| 7 | ✅ Fantasy football |
| 8 | ✅ External API integration — football-data.org, caching, rate-limit handling |
| 9 | ✅ Full Socket.io wiring — live scores, bracket auto-updates, match chat |
| 10 | ✅ Frontend (React) — bracket visualization, dashboards, auth flows |

## Suggested next steps (beyond the original scope)
- Swagger/OpenAPI docs for the REST API
- PDF bracket export
- Email notifications (Nodemailer — package already included)
- Deployment guide (Render/Railway for the API + Postgres, Vercel/Netlify for the frontend)
- Replace the manual fantasy stat-entry endpoint with an automated sync job pulling from the football-data.org integration already built in Step 8

Extras planned once the core is solid: email notifications, avatar uploads,
PDF bracket export, Swagger docs, deployment guide.

## Security notes
- Passwords: bcryptjs, 12 salt rounds
- Refresh tokens: httpOnly + `sameSite: strict` cookie, hashed at rest, revocable
- Role assignment: never trusted from client input on registration
- Rate limiting: stricter limiter on `/api/auth/*`, global limiter on everything else
- Input validation: Joi schemas on every write endpoint
- `helmet()` for standard HTTP security headers
