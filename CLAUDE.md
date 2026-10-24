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
- Never print `.env` values. The variable names are: `PORT, admin_username, admin_password_hash, gmail_address, gmail_password, atlasDB_password, atlasDB_name, STRIPEKEY, JWT_SECRET` (plus an unused `PRICE_ID` and unused `DB_*` Postgres block). The server exits at startup if `JWT_SECRET`, `admin_username` or `admin_password_hash` is missing.

## Layout

- `server/index.js`: Express app. Order matters: HSTS, HTTPS redirect (production only), JSON, `cors()`, static `client/dist`, DB connect, routes, catch-all to `index.html`.
- `server/routes|controllers|models|middleware`: `bookings`, `admin` (login, season dates), `charters` (Stripe), `notes`. `middleware/requireAuth.js` checks the JWT. `scripts/hash-password.js` makes the bcrypt hash for `admin_password_hash`.
- `client/src/views` (pages), `components` (shared), `components/dashboard` (dashboard pieces), `hooks/useSeasonDates.js`, `services.jsx/` (API helpers, `auth.jsx` holds the token and `authAxios`), `utils/dates.js`, `css/`.

## Data and rules to remember

- **Dates** are `dd-mm-yyyy` strings in bookings, availability and notes (`utils/dates.js` formats and parses them). Season dates are plain `YYYY-MM-DD` over the API and stored as UTC midnight.
- **Collections:** the model named `Admin` is the `admins` collection and holds the single season-dates document. Don't rename it: production uses it. Model `bookings` is the `bookings` collection.
- **Timeslots** are `'11am'` and `'2pm'`. Default capacity is 12. Seats left = capacity minus (adults + children) of non-cancelled bookings. This calculation exists twice (`controllers/bookings.js` and `controllers/charters.js`), so change both.
- **Cancel, not delete:** bookings have `status` (`active` or `cancelled`) and `cancelledAt`. A booking with no `status` counts as active. Day view and search hide cancelled bookings unless `?includeCancelled=true`. Permanent delete only works on cancelled bookings.
- **Incomplete bookings are allowed on the dashboard** (`POST /bookings/admin-add`): names, email, phone and party size may be missing. Anything that renders or emails a booking must cope with that: skip the customer email when there is no address, and use `save({ validateBeforeSave: false })` when saving them. The public route (`/bookings/add`) requires everything.
- **Charters** block a slot by overwriting `Availability.capacity` and rely on `availability === 12`. This is a known bug (spec P0-4). The booking is created from the `/success` page, not a webhook (spec P0-2).
- **Emails are real.** Add, update, cancel, restore and charter all send through Gmail. In tests, mock nodemailer (see below). Update and cancel always email the owner address too.

## Auth

- Login `POST /admin/login` (rate limited to 5 per 15 min per IP) returns an 8-hour JWT. The client keeps it in `localStorage` under `adminToken` and sends `Authorization: Bearer ...`.
- **Public routes:** `POST /bookings/add`, `POST /bookings/monthAvailability`, `GET /admin/getSeasonDates`, `/charters/*`. **Everything else must use `requireAuth`**, including any new dashboard route.
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
- Start the test API with a temporary password hash (`admin_password_hash=$(node -e 'console.log(require("bcryptjs").hashSync("pw",4))')`) and a preload that replaces `nodemailer.createTransport` with a fake that logs recipients (`NODE_OPTIONS="-r mock-mail.js"`). Check the log to see who would have been emailed.
- The login limiter (5 per 15 min) will lock a test API after a few runs, so restart it between runs. Stop servers by the PID that owns the port (`ss -ltnp`), not by a saved PID file, and only ones you started.
- The sandbox database is real shared data. Tag test records `ZZTEST` and delete them afterwards, then check none are left. Never write to the production database.

## Working with this owner

- Commit only when asked. The owner pushes themselves. Branch is `version2`. Leave unrelated pre-existing changes out of commits.
- For anything with a real design choice or behaviour change (new workflow, data changes), give a short recommendation and the options, and ask. Once they say go, implement and verify in the browser.
- They want simple solutions that suit one person running a small business, and plain-language explanations. Be upfront about what was and wasn't tested, and about side effects of a change.
- They prefer fields to be optional on the dashboard and strict for customers.
