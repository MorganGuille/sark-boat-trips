# CLAUDE.md

Sark Boat Trips: booking site and owner dashboard for a small boat-trip business. MERN stack (React 19 + Vite client, Express 4 + Mongoose server, MongoDB Atlas, Stripe for charters, Gmail SMTP for email). Single owner uses the dashboard. This repo is the **sandbox** (`version2` branch, sandbox DB `Bookings-Sandbox`); production is the Heroku app from `main`.

The backlog is in `spec.md`. Update it when an item is done or a new problem turns up.

## Run, lint, build

- Dependencies: server deps are in the **root** `package.json` (no `server/package.json`); client deps in `client/package.json`.
- **Server:** `cd server && node index.js` (default port 4040). dotenv reads `.env` from the *current directory*, so it must be started from `server/`. Heroku runs `node server/index.js` with config vars instead. No auto-reload: restart after server changes.
- **Client:** `cd client && npm run dev` (Vite, port 5173).
- **API URL:** hand-edited in `client/config.js`. It is deliberately set to the local server on this branch. The owner flips it to the Heroku URL before deploying, so remind them (see spec P1-6).
- **Lint:** `cd client && npx eslint --rule 'react/prop-types: off' <files you touched>`. The whole-repo baseline is 108 errors, so don't lint everything.
- **Build:** `npm run build` rewrites the *tracked* `client/dist` and `dist-server`. Don't run it in place. For a build check use `npx vite build --outDir <scratch dir>`. If dist gets modified by accident, `git checkout -- client/dist` and delete the new hashed files.
- Never print `.env` values. The variable names are: `PORT, admin_username, admin_password_hash, gmail_address, gmail_password, atlasDB_password, atlasDB_name, STRIPEKEY, JWT_SECRET` plus `STRIPE_WEBHOOK_SECRET` (the `whsec_...` signing secret from the Stripe webhook; without it `/charters/webhook` returns 503 and `/success` still creates the booking), and an unused `PRICE_ID` and unused `DB_*` Postgres block. The server exits at startup if `JWT_SECRET`, `admin_username` or `admin_password_hash` is missing.

## Layout

- `server/index.js`: Express app. Order matters: HSTS, HTTPS redirect (production only), JSON, `cors()`, static `client/dist`, DB connect, routes, catch-all to `index.html`.
- `server/routes|controllers|models|middleware`: `bookings`, `admin` (login, season dates), `charters` (Stripe), `notes`. `middleware/requireAuth.js` checks the JWT. `scripts/hash-password.js` makes the bcrypt hash for `admin_password_hash`.
- `client/src/views` (pages), `components` (shared), `components/dashboard` (dashboard pieces), `hooks/useSeasonDates.js`, `services.jsx/` (API helpers, `auth.jsx` holds the token and `authAxios`), `utils/dates.js`, `css/`.

## Data and rules to remember

- **Dates** are `dd-mm-yyyy` strings in bookings, availability and notes (`utils/dates.js` formats and parses them). Season dates are plain `YYYY-MM-DD` over the API and stored as UTC midnight.
- **Collections:** the model named `Admin` is the `admins` collection and holds the single season-dates document. Don't rename it: production uses it. Model `bookings` is the `bookings` collection.
- **Timeslots** are `'11am'` and `'2pm'`. Default capacity is 12. All seat counting lives in `server/utils/availability.js`: seats left = capacity minus (adults + children) of non-cancelled bookings, or 0 if the trip has an active charter. `isSlotEmpty` (open and no bookings at all) is the rule for booking a charter. Don't copy this logic elsewhere.
- **Cancel, not delete:** bookings have `status` (`active` or `cancelled`) and `cancelledAt`. A booking with no `status` counts as active. Day view and search hide cancelled bookings unless `?includeCancelled=true`. Permanent delete only works on cancelled bookings.
- **Incomplete bookings are allowed on the dashboard** (`POST /bookings/admin-add`): names, email, phone and party size may be missing. Anything that renders or emails a booking must cope with that: skip the customer email when there is no address, and use `save({ validateBeforeSave: false })` when saving them. The public route (`/bookings/add`) requires everything.
- **Charters** (`charter: 'true'`) block their trip by existing as an active booking. Nothing writes to the `Availability` capacity rows for charters any more (older charters did, hence `scripts/cleanup-charter-capacity.js`).
- **Charter payments:** the booking is created by `fulfillCheckoutSession` in `controllers/charters.js`. It is called by both the Stripe webhook (`POST /charters/webhook`, mounted in `index.js` *before* `express.json()` because it needs the raw body) and the `/success` page, and is idempotent through the unique `stripeSessionId` on the booking. Only the call that creates the booking sends the emails. Keep it that way: don't create charter bookings anywhere else.
- **Emails are real.** Add, update, cancel, restore and charter all send through Gmail. In tests, mock nodemailer (see below). Update and cancel always email the owner address too.

## Auth

- Login `POST /admin/login` (rate limited to 5 per 15 min per IP) returns an 8-hour JWT. The client keeps it in `localStorage` under `adminToken` and sends `Authorization: Bearer ...`.
- **Public routes:** `POST /bookings/add`, `POST /bookings/monthAvailability`, `GET /admin/getSeasonDates`, `/charters/*`. **Everything else must use `requireAuth`**, including any new dashboard route.
- **Public routes are rate limited** (`middleware/rateLimiters.js`: per IP, plus per email for bookings; in memory, so they reset on restart) and the booking and charter-checkout routes have a **honeypot** (`middleware/honeypot.js`, hidden form field `website_url`). Any new public route that sends email or calls Stripe needs a limiter, and any new public booking form must include the honeypot field. Customer input goes through `utils/validateBooking.js`. The Stripe webhook is deliberately not limited.
- **Wrap every route handler in `asyncHandler`** (`middleware/asyncHandler.js`) when adding routes. Express 4 doesn't catch async errors, and an uncaught one used to crash the server. Errors then reach `middleware/errorHandler.js`, the last middleware in `index.js`, which returns a generic JSON error. Controllers can still catch errors themselves to give a specific message.
- On the client, use `authAxios` (from `services.jsx/auth.jsx`) for protected calls and plain `axios` for public ones. A 401 clears the token and logs the dashboard out.

## Front-end conventions

- Match the file you are in: client code is 4-space indented, JSX, no PropTypes, `.jsx` for components. Server controllers are mostly 4 spaces, a few files use 2.
- Dashboard CSS is scoped under `.dashboard`. Be careful with global CSS: `bookingForm.css` has bare `form div`, `form button`, `form select` and `form textarea` rules that apply to every form on every page, and `dashboard.css` keeps a global `input` rule other forms rely on.
- The site navbar is absolutely positioned (4rem, 5rem for the mobile burger), so pages need top padding to clear it.
- A visually hidden element (`.sr-only`) inside a scrolling container needs a `position: relative` ancestor, or it widens the page.
- `BookingForm` serves the public page, the charter page and the dashboard. New behaviour for one must not change the others: it takes optional `booking`, `onResult`, `onDone` props that only the dashboard passes.

## Testing and verifying changes

- Headless Chromium via Playwright is set up in the scratchpad (`pw/`). If it is missing: `npm i playwright && npx playwright install chromium` in the scratchpad, never in the repo.
- The owner usually has their own server on **4040** and Vite on **5173** running. Don't kill or reuse them. Use test ports **4141** (API) and **5199** (Vite). The client's API URL points at 4040, so redirect it in Playwright: `page.route('http://127.0.0.1:4040/**', r => r.continue({ url: r.request().url().replace(':4040', ':4141') }))`.
- To test Stripe flows without Stripe: use the real `stripe` library (so signatures are really checked) but replace `checkout.sessions.retrieve` from a preload; sign test webhooks with `stripe.webhooks.generateTestHeaderString({ payload, secret })` and set `STRIPE_WEBHOOK_SECRET` on the test API. Use far-future dates (e.g. `01-01-2031`) and `ZZTEST` names, and delete the bookings and any `availabilities` rows created.
- Rate limits key on `req.ip`, and the app trusts one proxy hop, so a test can pose as different visitors by sending `X-Forwarded-For: 10.x.x.x`. Counters are per server process, so restart the test API between suites.
- Start the test API with a temporary password hash (`admin_password_hash=$(node -e 'console.log(require("bcryptjs").hashSync("pw",4))')`) and a preload that replaces `nodemailer.createTransport` with a fake that logs recipients (`NODE_OPTIONS="-r mock-mail.js"`). Check the log to see who would have been emailed.
- The login limiter (5 per 15 min) will lock a test API after a few runs, so restart it between runs. Stop servers by the PID that owns the port (`ss -ltnp`), not by a saved PID file, and only ones you started.
- The sandbox database is real shared data. Tag test records `ZZTEST` and delete them afterwards, then check none are left. Never write to the production database.

## Working with this owner

- Commit only when asked. The owner pushes themselves. Branch is `version2`. Leave unrelated pre-existing changes out of commits.
- For anything with a real design choice or behaviour change (new workflow, data changes), give a short recommendation and the options, and ask. Once they say go, implement and verify in the browser.
- They want simple solutions that suit one person running a small business, and plain-language explanations. Be upfront about what was and wasn't tested, and about side effects of a change.
- They prefer fields to be optional on the dashboard and strict for customers.
- They plan to move off the free `@gmail.com` sending address soon (see spec P2-10). Don't add more hard-coded copies of it; use the config once P2-11 exists.

## Before moving the sandbox to production

**When the owner says they are moving this sandbox to production, remind them of this checklist before doing anything else.**

1. **Stripe webhook** (until it is set up, charters still work through the `/success` page, but a customer who pays and closes the tab gets no booking):
   1. Stripe dashboard → Developers → Webhooks → Add endpoint. Make sure the Test/Live toggle matches the key the server uses (`STRIPEKEY`).
   2. Endpoint URL: `https://secret-eyrie-44762-a52d7fb9dbaa.herokuapp.com/charters/webhook` (the domain checkout returns customers to; use the real domain if that changes).
   3. Events: `checkout.session.completed`, and ideally `checkout.session.async_payment_succeeded`.
   4. Copy the signing secret (`whsec_...`) and run `heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...`. Locally, put it in `server/.env` and use `stripe listen --forward-to localhost:4040/charters/webhook`, which prints its own secret.
   5. After deploying, use "Send test webhook". It should show a 200 reply (the sample event has no charter details, so it creates no booking).
2. **Heroku config vars** (the server exits at startup if the first three are missing): `admin_username`, `admin_password_hash` (make it with `node server/scripts/hash-password.js`), `JWT_SECRET` (long and random, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), `STRIPE_WEBHOOK_SECRET`, plus the existing `atlasDB_name` (**the production database, not `Bookings-Sandbox`**), `atlasDB_password`, `gmail_address`, `gmail_password`, `STRIPEKEY` (live key).
3. **`client/config.js`**: switch the URL back to the Heroku one. It is set to the local server on this branch.
4. **Deploy client and server together.** The dashboard now calls `/bookings/cancel`, `/restore` and `/permanently-delete`, and `/bookings/delete` no longer exists, so an old client with a new server (or the reverse) will break cancelling.
5. **Production data:** take or confirm an Atlas backup first. No data migration is needed: bookings without a `status` count as active. The first start creates a unique index on `bookings.stripeSessionId` (harmless). Check the production `admins` collection still has the season-dates document.
6. **After deploying:** log in to the dashboard, check the season dates, make and cancel a test booking, and (if possible) run one small real charter payment and confirm the booking, the emails and the webhook delivery in Stripe.
7. **One-off charter cleanup (P0-4):** old charters overwrote a trip's capacity, and cancelling them left it stuck. After deploying, run a dry run against production, read the output, then apply: `heroku run node server/scripts/cleanup-charter-capacity.js`, then the same with `--apply`. It prints the database name first, so check it says the production database. It only deletes capacity rows that match a charter's party size; anything else it lists for review (for example, a capacity you set on purpose).
8. Anything in `spec.md` marked DONE only counts once it is deployed.
