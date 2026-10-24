# Sark Boat Trips: priority fixes and improvements

Written after reading the whole codebase and testing the booking and dashboard flows in a browser (branch `version2`, 24 Oct 2026). Items marked **[verified]** were reproduced by running the code. The rest come from reading it, and say so where it matters.

**Priorities**
- **P0**: can lose money, crash the server or be abused. Fix before relying on it.
- **P1**: wrong or fragile behaviour, or a gap that will bite soon.
- **P2**: worthwhile improvements.
- **P3**: nice to have or tidy-up.

**Effort**: S is under half a day, M is a day or two, L is more.

**Areas**: `[Server]`, `[Client]`, `[Owner]` (the dashboard), `[Customer]` (the public site), `[Build]`.

## Summary

| ID | Area | Item | Effort |
|---|---|---|---|
| P0-1 | Server | A Stripe error crashes the whole server **[verified]** | S |
| P0-2 | Server | Charter booking is only created if the customer's browser reaches `/success` | M |
| P0-3 | Server | `verifyPayment` double-responds, hangs, and fails on refresh | S |
| P0-4 | Server | Cancelling a charter never frees the slot | M |
| P0-5 | Server | Public endpoints can be abused to send email through your Gmail | S–M |
| P1-1 | Server | Booking is saved after the emails, so failures leave inconsistent state | S |
| P1-2 | Customer | The booking form shows nothing when the server rejects a booking | S |
| P1-3 | Server | No server-side validation of dates, party size, timeslot or email format | M |
| P1-4 | Server | Editing a booking ignores availability and always emails the customer | M |
| P1-5 | Server | Customer text is put into HTML emails unescaped | S |
| P1-6 | Build | Switching local/production is a hand-edited URL, and the Stripe return URL is hard-coded to production | S |
| P1-7 | Server | Open CORS and almost no security headers | S–M |
| P1-8 | Build | No tests and no CI | M |
| P1-9 | Server | No error reporting, backup check, or separation of sandbox and production | S |
| P1-10 | Server | Dates stored as `dd-mm-yyyy` strings | M–L |
| P2-1 | Owner | Printable day sheet and CSV export | S–M |
| P2-2 | Owner | Weather tools: close a trip, notify everyone on a slot | M |
| P2-3 | Owner | Month overview and better search | M |
| P2-4 | Owner | Per-booking notes and payment status | M |
| P2-5 | Owner | Deliberate overbooking override | S |
| P2-6 | Customer | Manage-my-booking link (self-service change and cancel) | M |
| P2-7 | Customer | Reminder email the day before | S–M |
| P2-8 | Customer | Booking form polish (price total, closed days, keep data on error) | M |
| P2-9 | Client | Each public route prerendered separately, plus sitemap and noindex | M |
| P2-10 | Server | Move off Gmail SMTP to a transactional email service | M |
| P2-11 | Server | Business settings hard-coded in many files | M |
| P2-12 | Server | Overbooking race condition | M |
| P2-13 | Owner | Customer data tools (find, export, erase by email) | S |
| P3-1 | Build | Untrack committed build output | S |
| P3-2 | Build | Lint baseline of 108 errors | S–M |
| P3-3 | Server | Models: indexes and numeric defaults | S |
| P3-4 | Server | Consistent response shape and status codes, a global error handler | M |
| P3-5 | Client | Split `BookingForm`, remove duplicated helpers, namespace global CSS | M |
| P3-6 | Owner | Dashboard niceties (undo, in-page dialogs, session controls) | M |
| P3-7 | Customer | Accessibility pass | S–M |
| P3-8 | Docs | README and `.env.example` | S |

---

## P0: fix before relying on it

### P0-1 `[Server]` A Stripe error crashes the whole server **[verified]**
- **Status: DONE** (24 Oct 2026, not yet pushed).
  - `createCheckOutSession` now has a `try/catch` and returns a 502 with a clear message.
  - Every route is wrapped in `asyncHandler`, with a final `errorHandler` and a logged `unhandledRejection` safety net.
  - Long customer messages are cut to Stripe's 500-character limit.
  - The charter form shows the error in its popup.
  - Verified: a stubbed Stripe outage gets the message and the server keeps serving, a stray rejection is logged without a crash, and the normal checkout path is unchanged. The "no spaces left" path was also verified against a fully booked slot. An automated test is still outstanding (P1-8).
- **Problem:** [createCheckOutSession](server/controllers/charters.js) has no `try/catch`. I started the server with an invalid Stripe key and posted a charter booking: the process died and the port stopped listening. Express 4 doesn't catch rejected promises, and Node 22 exits on an unhandled rejection. Anything that makes Stripe fail (bad key, outage, a `message` over Stripe's 500-character metadata limit) takes the whole site down until Heroku restarts it.
- **Fix:**
  - Wrap the handler in `try/catch` and return a clear error to the customer.
  - Add an Express error-handling middleware and a small `asyncHandler` wrapper (or move to Express 5) so no async route can crash the process.
  - Add `process.on('unhandledRejection')` that logs, as a last resort.
  - Truncate or validate `message` before putting it in Stripe metadata.
- **Done when:** a test that makes Stripe throw gets a 4xx or 5xx JSON response and the server keeps serving requests.

### P0-2 `[Server]` Charter booking only exists if the customer's browser reaches `/success`
- **Problem:** The booking is created in [verifyPayment](server/controllers/charters.js), which is only called by the `/success` page in the customer's browser. If they pay and then close the tab, lose signal on the ferry, or the page fails to load, **the customer has paid and no booking exists** and you get no email.
- **Fix:**
  - Add a Stripe webhook (`checkout.session.completed`) at a raw-body route, with signature verification.
  - It creates the booking, sends both emails, and is **idempotent**: store the Stripe session id on the booking with a unique index, so duplicate deliveries or a parallel `/success` call can't create two.
  - Make `/success` read-only: it only looks up the status of the booking for that session.
- **Needs from you:** adding the webhook endpoint and its signing secret in the Stripe dashboard.
- **Done when:** paying and closing the tab immediately still produces one booking and both emails.

### P0-3 `[Server]` `verifyPayment` double-responds, can hang, and fails on refresh
- **Problem** (from reading the code):
  - If sending email fails, it sends a 500 and then falls through to `res.json(...)` again. The second send throws "headers already sent" inside the `catch`, which is an unhandled rejection and crashes the process.
  - If `payment_status` is anything other than `paid` or `unpaid`, no response is sent and the request hangs.
  - The "slot is still free" check (`availability != 12`) runs before the payment check. After a successful payment, refreshing `/success` reports "no availability", so a paying customer sees a failure message.
- **Fix:** Folded into P0-2: one status lookup, one response per request, every `payment_status` handled, safe to call repeatedly.
- **Done when:** refreshing `/success` shows the same confirmation, and an email failure never triggers a second response.

### P0-4 `[Server]` Cancelling a charter never frees the slot
- **Problem:** A paid charter blocks the slot by overwriting the `Availability` capacity to the party size (`capacity: totalpax` in `verifyPayment`) and relying on `availability === 12` elsewhere. Cancel or delete the booking and the capacity override stays, so the slot never frees and that trip shows only the party's number of seats. This predates the cancel feature but the cancel feature makes it easy to hit. It also means charters stop working if you ever set a default capacity other than 12.
- **Fix:**
  - Work out availability as: a trip is full if there is an active charter booking for that date and slot; otherwise `capacity` minus active party sizes.
  - Stop writing to `Availability` for charters.
  - Replace the magic `12` with the real capacity.
  - Add a one-off script to remove old charter-caused capacity overrides.
- **Done when:** booking a charter fills the slot, cancelling it frees the slot, and restoring it fills the slot again.

### P0-5 `[Server]` Public endpoints can be abused to send email through your Gmail
- **Problem:** `/bookings/add` and `/charters/create-checkout-session` have no rate limiting, CAPTCHA or bot check. Anyone can script them to send confirmation emails to arbitrary addresses (spam or harassment from your address, then Gmail suspends the account and real confirmations stop). It also lets bots fill your slots. The monthly availability endpoint accepts an unbounded list.
- **Fix:**
  - Add `express-rate-limit` per IP: for example 5 bookings per 15 minutes, with looser limits for availability.
  - Add a hidden honeypot field, and Cloudflare Turnstile if bots appear.
  - Cap `dates.length` in `monthAvailability`.
  - Require a valid email format (see P1-3).
- **Done when:** the 6th booking in the window from one IP gets a 429, and a request with the honeypot filled is silently dropped.

---

## P1: important

### P1-1 `[Server]` Booking is saved after the emails, so failures leave inconsistent state
- **Problem:** In [addBooking](server/controllers/bookings.js) the confirmation and admin emails are sent first and the booking is created afterwards. If sending fails, the booking is never created, but the response says "Booking confirmed, but email sending failed". If creation fails after the emails are sent, the customer has a confirmation for a booking that doesn't exist.
- **Fix:** Create the booking first, then send emails. If an email fails, keep the booking, tell the customer it is booked and that the email failed, and email or flag the owner. Use the same order for the charter flow.

### P1-2 `[Customer]` The booking form shows nothing when the server rejects a booking
- **Problem:** In [bookingForm.jsx](client/src/components/bookingForm.jsx) the public submit handlers only `console.log` on error. A 400 (incomplete), a 429 (once rate-limited) or a 500 leaves the customer with a form that silently does nothing. `ok: false` responses with a 200 status (no spaces left) are shown, but errors thrown by axios are not.
- **Fix:** Show the server's message for every failure, in the existing popup or inline, for both the normal and charter forms. Keep what the customer typed. Add a generic "something went wrong, please call or email us" fallback.

### P1-3 `[Server]` No server-side validation of dates, party size, timeslot or email format
- **Problem:** The booking calendar limits dates in the browser only. A direct API call can book a past date, a date outside the season, a nonsense date string, 500 adults, or a timeslot that doesn't exist. Email format isn't checked. (The public route now requires non-empty fields, but nothing more.)
- **Fix:** One shared validation module used by add, admin-add and update:
  - date format, not in the past, within the season (public only)
  - timeslot from a list
  - adults 1–12 and children 0–12 as whole numbers
  - total party within capacity
  - email format and length limits
- Consider a same-day cutoff. Use the Europe/Guernsey timezone, not the Heroku server's UTC, for "today" and cutoffs.
- **Done when:** each bad input gets a 400 with a specific message and has a test.

### P1-4 `[Server]` Editing a booking ignores availability and always emails the customer
- **Problem:** [updateBooking](server/controllers/bookings.js) doesn't re-check capacity when the date, timeslot or party size changes, so edits can overbook a trip. It always emails the customer and admin. Falsy values are ignored, so you can't clear a field such as accommodation. It builds the email before checking the booking exists.
- **Fix:**
  - Re-check availability for the new date, slot and size, excluding this booking.
  - Add a "notify customer" checkbox on the edit form, defaulting to on.
  - Allow empty strings.
  - Return 404 before building the email.

### P1-5 `[Server]` Customer text is put into HTML emails unescaped
- **Problem:** First name, message, accommodation and so on are interpolated straight into the HTML of the admin and customer emails. A customer (or bot) can inject markup or links into an email that comes from your address.
- **Fix:** One `escapeHtml` helper used by every template. This is easiest as part of P2-10 (a single mailer module).

### P1-6 `[Build]` Switching between local and production is a hand-edited URL, and the Stripe return URL is hard-coded to production
- **Problem:**
  - [client/config.js](client/config.js) is switched by commenting lines in and out, and the wrong one is easy to commit and deploy.
  - [charters.js](server/controllers/charters.js) has `YOUR_DOMAIN` hard-coded to the Heroku URL. A charter test from the sandbox sends the customer back to the production site, whose `/success` verifies against the production database.
- **Fix:**
  - Use `import.meta.env.VITE_API_URL`, with `.env.development` (local) and none in production (use same-origin relative URLs, since the server serves the client, which also removes the need for CORS).
  - Read the domain and Stripe price id from environment variables (the unused `PRICE_ID` in `.env` was probably meant for this).
- **Done when:** nothing needs hand-editing to deploy, and a sandbox charter test returns to the sandbox.

### P1-7 `[Server]` Open CORS and almost no security headers
- **Problem:** `cors()` allows every origin, and helmet is only used for HSTS (no CSP, no frame or sniffing protection).
- **Fix:** After P1-6, restrict CORS to your own origins (or remove it if same-origin). Enable `helmet()` defaults with a CSP that allows Stripe, Google Fonts and Vimeo. Test the public pages and checkout carefully, because a too-strict CSP breaks embeds.

### P1-8 `[Build]` No tests and no CI
- **Problem:** There are no tests, and the 108 lint errors mean lint isn't a usable gate. Every change is verified by hand.
- **Fix:**
  - Server API tests (supertest plus an in-memory MongoDB) for availability maths, public validation, auth gating, cancel and restore, and the charter and webhook flow with Stripe mocked.
  - Turn the Playwright setup I used into a small `e2e/` suite with a mocked mailer: booking, dashboard login, cancel and restore.
  - A GitHub Actions workflow running lint, tests and the build.
- **Done when:** a push that breaks booking or auth fails CI.

### P1-9 `[Server]` No error reporting, backup check, or separation of sandbox and production
- **Problem:** Everything is `console.log`, so you'd only learn about a failure when a customer tells you. Email failures are swallowed. I don't know whether Atlas backups are enabled. The sandbox and production databases appear to live on the same Atlas cluster and use the same database user.
- **Fix:**
  - Add error reporting (Sentry's free tier, or a Heroku log drain).
  - Notify the owner when a customer email fails.
  - Confirm Atlas automated backups and add an alert.
  - Give the sandbox its own database user restricted to the sandbox database.

### P1-10 `[Server]` Dates are stored as `dd-mm-yyyy` strings
- **Problem:** Strings in this format can't be sorted or range-queried correctly, so month views, reports, reminders and "upcoming bookings" are awkward or wrong. Every comparison is a string comparison. The same format is parsed in many places.
- **Fix:** Store `YYYY-MM-DD` (or a real Date at UTC midnight) for bookings, availability and notes. Write a one-off migration script with a dry-run mode and a backup, and keep dd-mm-yyyy for display only (one shared helper). Do this before the owner features in P2.
- **Done when:** the app works end to end on migrated sandbox data and a rollback plan exists.

---

## P2: improvements

### Owner side

#### P2-1 `[Owner]` Printable day sheet and CSV export
For each trip: names, party sizes, phone numbers, accommodation and notes, on one printable page, plus CSV export for a date range. This is the single most useful daily tool for running the boat.

#### P2-2 `[Owner]` Weather tools
- A "Close this trip" button (capacity 0 with one click).
- "Notify everyone on this trip" with a template and a preview, so a weather change is one action instead of a phone call per booking. Optionally let each customer's email offer to move to another slot.

#### P2-3 `[Owner]` Month overview and better search
Bookings and guests per day and slot on the calendar, an "upcoming bookings" list, and search by email, phone and date range (today only last name works).

#### P2-4 `[Owner]` Per-booking notes and payment status
A note on each booking (not just per day), a paid/unpaid or deposit flag, a no-show mark, and for charters the Stripe payment with a link to refund it.

#### P2-5 `[Owner]` Deliberate overbooking override
The dashboard add form currently refuses a booking if the trip is full. Add an explicit "add anyway" confirmation for when you know you can take extra people.

#### P2-13 `[Owner]` Customer data tools
One place to find everything held for an email address, export it, and erase it (permanent delete already exists per booking). Update the privacy policy's retention paragraph to state that cancelled bookings are kept until a customer asks for removal, which is current practice.

### Customer side

#### P2-6 `[Customer]` Manage-my-booking link
A signed link in the confirmation email where the customer can view their booking and cancel it (up to a cutoff you choose) or request a change. It cuts down on phone calls and emails.

#### P2-7 `[Customer]` Reminder email the day before
Meeting point, what to bring and a weather note. Run it with Heroku Scheduler. It reduces no-shows. Needs P1-10 to query "tomorrow's bookings" reliably.

#### P2-8 `[Customer]` Booking form polish
- Show the price total as the party size changes.
- Disable past days and days outside the season on the calendar (the hard-coded "Prices for 2026" text needs to come from config, see P2-11).
- Keep entered data after an error.
- Show a confirmation summary and an "add to calendar" file.

### Back end and build

#### P2-9 `[Client]` Each public route prerendered separately
- **Problem (to verify, from reading the code):** [prerender.js](client/prerender.js) renders only `/` and the server returns that same `index.html` for every route. On `/charters` or `/bookings`, the HTML is the home page, which then fails to match what React renders on load, so React logs a hydration error and re-renders. Search engines also see the home page's markup and title for those routes.
- **Fix:** Prerender each public route to its own file and have the server serve the right one. Add `sitemap.xml`, add `Disallow: /dashboard` to `robots.txt`, and a `noindex` meta tag on the dashboard, success and canceled pages.

#### P2-10 `[Server]` Move off Gmail SMTP
Gmail SMTP has daily sending limits, weaker deliverability (your own email asks customers to check spam), and it ties delivery to one personal account. Use a transactional service (Resend, Postmark or SES) behind one `mailer.js` module that also holds the three email layouts now copied across the code, the HTML escaping (P1-5), and failure alerts to you.

#### P2-11 `[Server]` Business settings hard-coded in many files
Timeslots (`'11am'`, `'2pm'`), default capacity 12, prices and the "2026" text, the Stripe price id, the domain, and the email addresses are scattered across files. Put them in one server config plus a small settings document editable from the dashboard, and have the client read them.

#### P2-12 `[Server]` Overbooking race condition
Booking checks availability and then creates the record, which isn't atomic. Two customers submitting at once for the last seats can both succeed. Fix with a re-check after insert (undo if over capacity) or an atomic per-slot counter. Low risk at your volume, so do this after the other server work.

---

## P3: tidy-up and later

- **P3-1 `[Build]` Untrack build output.** `client/dist` and `client/dist-server` (31 files) are committed. Add them to `.gitignore` and `git rm --cached` them. First confirm that Heroku builds them itself (it does run `heroku-postbuild`).
- **P3-2 `[Build]` Lint baseline.** 108 errors, mostly `react/prop-types` and unused `React` imports. Either adopt PropTypes or turn that rule off, fix the rest, move the deprecated `.eslintignore` into `eslint.config.js`, then make `npm run lint` pass and run it in CI.
- **P3-3 `[Server]` Models.** No indexes exist. Add one on `{date, timeslot, status}` for bookings and `{date, timeslot}` for availability. Default `adults` and `children` to 0 so a missing number can never turn the seat total into `NaN`.
- **P3-4 `[Server]` Responses and errors.** Many endpoints return 200 with `ok: false`, and the response shape varies (`data`, `message`, `error`). Pick one shape, use real status codes, and add the global error handler from P0-1. Consider an `/api` prefix on the routes so API paths can't be confused with client routes.
- **P3-5 `[Client]` Components and CSS.** Split `BookingForm` (it handles public bookings, charters and the dashboard) into form pieces that share fields. Remove the duplicated `formatDate` in `bookings.jsx` and `myCalendar.jsx`. Namespace the global CSS rules (`form div`, `form button` in `bookingForm.css`, `input` in `dashboard.css`) so styles can't leak between pages.
- **P3-6 `[Owner]` Dashboard niceties.** An undo toast after Cancel, in-page confirm dialogs instead of `window.confirm`, remembering the selected tab, a "log out everywhere" option and optional two-factor sign-in.
- **P3-7 `[Customer]` Accessibility pass.** Run axe in the Playwright suite, then check calendar tile contrast, focus order and screen-reader announcements.
- **P3-8 `[Docs]` README and `.env.example`.** The README has no setup or environment instructions. Add them, and a `.env.example` listing the real variables. The current `.env` also has an unused PostgreSQL block (`DB_*`) to remove.

---

## Suggested order of work

1. **Safety (P0 plus P1-6):** P0-1, P0-5, P1-6, then P0-2, P0-3, P0-4 as one Stripe pass.
2. **Correctness:** P1-3, P1-1, P1-2, P1-4, P1-5, with P1-8 (tests and CI) built alongside so each fix has a test.
3. **Foundations:** P1-10 (date format), P1-9, P1-7, P3-1, P3-2.
4. **Owner value:** P2-1, P2-2, P2-3, P2-4.
5. **Customer growth and SEO:** P2-9, P2-6, P2-7, P2-8, P2-10.

## Decisions needed from you

- **Stripe webhook (P0-2):** is it OK to configure one in the Stripe dashboard? Do you want a refund flow for cancelled charters in P2-4?
- **Email provider (P2-10):** are you happy to move from Gmail to Resend, Postmark or SES, and to change the "from" address if needed?
- **Self-service cancellation (P2-6):** how close to the trip should customers be allowed to cancel themselves, if at all?
- **Cutoff (P1-3):** should the website stop taking same-day bookings at some time?
- **Settings in the dashboard (P2-11):** which settings do you want to change yourself (prices, capacity, timeslots)?
