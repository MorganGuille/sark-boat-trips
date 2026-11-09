# Sark Boat Trips: priority fixes and improvements

Written after reading the whole codebase and testing the booking and dashboard flows in a browser (branch `version2`, 24 Oct 2026). Items marked **[verified]** were reproduced by running the code. The rest come from reading it, and say so where it matters.

**Priorities**
- **P0**: can lose money, crash the server or be abused. Fix before relying on it.
- **P1**: wrong or fragile behaviour, or a gap that will bite soon.
- **P2**: worthwhile improvements.
- **P3**: nice to have or tidy-up.

**Effort**: S is under half a day, M is a day or two, L is more.

**Areas**: `[Server]`, `[Client]`, `[Owner]` (the dashboard), `[Customer]` (the public site), `[Build]`.

## Progress (2 Nov 2026)

**Done in the sandbox (`version2`), not yet deployed:** P0-1 to P0-5, P1-1 to P1-10 (error reporting in P1-9 was skipped by the owner), P2-1 (prices and the monthly CSV report), P3-2 (lint), P2-4 in full (merged from the `payments` branch on 30 Oct; see `paymentsspec.md`: payment status with Mark paid / Undo paid, a card saved on Stripe's page for every online booking, charged automatically at the trip time, infants, the cancellation rules on `/terms` and `/privacy`, and **Cancel a whole trip**, part of P2-2), P2-10 plus the email part of P2-11 (the site sends from `info@sarkboattrips.com` through Zoho; addresses come from settings), and P2-7 (the reminder email at 6pm the evening before).

**Merged into `version2` (2 Nov 2026):** P2-15, gift vouchers bought online, and the home page redesign (see "Home page redesign" under P2-14).

**Next:** the go-live steps in `CLAUDE.md` (P2-13, customer data tools, done 3 Nov 2026). Already on `version2` (all committed, 1 Nov 2026): P2-2 (trip tools), P2-12 (no overbooking), P2-6 (manage my booking), P2-8 (new booking form), P2-14 (mobile pass, tried on the owner's Android), P2-9 (each page prebuilt, robots.txt, sitemap), P2-3 (upcoming list and better search), and the client-side pass: new header and phone menu, new footer, charters section and page, the home page video, and a steady hero on phones (see "Header and footer redesign" under P2-14). Anything marked DONE only counts once it is deployed.

**Owner's decisions on gift vouchers (2 Nov 2026):** a voucher for more people than come is used up (the owner can put it right in person); customers can't change or cancel a booking with a voucher on it themselves, for now; no header link (footer and home page only).

**Code review (9 Nov 2026):** see "Code review" near the end. R-1 to R-17 are fixed on the `review-fixes` branch (to merge into `version2`); R-18 (package advisories) and R-19 (tidy-up) are open. **Before go-live: one test booking against real Stripe test mode, for R-11.**

**Waiting on the owner:** an evening photo for the charters page's evening card (it borrows a coastline shot); a check of the home page photo descriptions (`views/home.jsx`); a try on a real iPhone before go-live. The owner's ngrok address (`strained-raking-acquire.ngrok-free.dev`, port 4041 copy) is how they check changes on their Android.

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
| P1-9 | Server | No error reporting, backup check, or separation of sandbox and production (**DONE**, except error reporting) | S |
| P1-10 | Server | Dates stored as `dd-mm-yyyy` strings (**DONE**) | M–L |
| P2-1 | Owner | Monthly passenger and income CSV, and price settings (**DONE**; the day sheet was dropped) | S–M |
| P2-2 | Owner | Trip tools: change a trip's time for one day, close a trip, notify everyone on it (cancel a whole trip **DONE**; change time and harbour, message everyone, and extra trips, **DONE** on the `trip-tools` branch) | M–L |
| P2-3 | Owner | Upcoming bookings and better search (**DONE**; the calendar is left as it is, owner's choice) | M |
| P2-4 | Owner | Card saved at booking, charged at the trip time; payment status (see `paymentsspec.md`) (**DONE**) | L |
| P2-6 | Customer | Manage-my-booking link (self-service change and cancel): DONE | M |
| P2-7 | Customer | Reminder email the day before (**DONE**) | S–M |
| P2-8 | Customer | Booking form polish: DONE (price total, closed days, keep data on error) | M |
| P2-9 | Client | Each public route prerendered separately, plus sitemap and noindex (**DONE**) | M |
| P2-10 | Server | Move off Gmail SMTP (**DONE**: Zoho, `info@sarkboattrips.com`, with SPF, DKIM and DMARC) | M |
| P2-11 | Server | Business settings hard-coded in many files (email addresses **DONE**; the rest **closed** by the owner, 2 Nov 2026) | M |
| P2-12 | Server | Overbooking race condition: DONE | M |
| P2-13 | Owner | Customer data tools (find, export, erase by email) (**DONE**, on `version2`) | S |
| P2-14 | Customer | Mobile-friendly pass over the whole website **DONE** | M |
| P2-15 | Customer | Gift vouchers bought online, with a dashboard list (**DONE**, on `version2`) | M–L |
| P3-1 | Build | Untrack committed build output (**DONE**, on `version2`) | S |
| P3-2 | Build | Lint baseline of 108 errors | S–M |
| P3-3 | Server | Models: indexes and numeric defaults (**DONE**, on `version2`) | S |
| P3-4 | Server | Consistent response shape and status codes, a global error handler | M |
| P3-5 | Client | Split `BookingForm`, remove duplicated helpers, namespace global CSS (**DONE**, on `version2`) | M |
| P3-6 | Owner | Dashboard niceties (undo, in-page dialogs) (**DONE**, on `version2`) | M |
| P3-7 | Customer | Accessibility pass (**DONE**, on `version2`) | S–M |
| P3-8 | Docs | README and `.env.example` | S |
| R-1 to R-17 | All | Code review, 9 Nov 2026: seventeen fixes (**DONE** on the `review-fixes` branch) | S each |
| R-18, R-19 | Build | Code review, 9 Nov 2026: package advisories and tidy-up (open) | S–M |

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
- **Status: DONE in code (24 Oct 2026), but the webhook still needs setting up in Stripe.** Until the owner does that, behaviour is the same as before: the booking is created when the customer reaches `/success`.
  - `POST /charters/webhook` verifies Stripe's signature and creates the booking and emails. It is mounted in `index.js` before `express.json()` because it needs the raw body.
  - Booking creation is one function (`fulfillCheckoutSession`) shared by the webhook and `/success`. It is keyed on the Stripe session id (unique sparse index), so a retry, a parallel call or a refresh can't duplicate the booking or the emails.
  - If someone else took the slot while the customer was paying, the paid charter is still saved and the customer is confirmed, but the owner gets an `ACTION NEEDED` email to move or cancel the other bookings, or to refund in Stripe. There is no automatic refund.
  - Verified with 31 checks: forged and wrong-secret signatures are rejected, retries and refreshes create nothing new, eight simultaneous requests give one booking and one pair of emails, and the unpaid, unknown and non-charter cases behave. Signatures were produced with Stripe's own signing function and the network call that fetches a session was faked. The first real end-to-end check is Stripe's "Send test webhook" button after setup.
- **Problem:** The booking is created in [verifyPayment](server/controllers/charters.js), which is only called by the `/success` page in the customer's browser. If they pay and then close the tab, lose signal on the ferry, or the page fails to load, **the customer has paid and no booking exists** and you get no email.
- **Fix:**
  - Add a Stripe webhook (`checkout.session.completed`) at a raw-body route, with signature verification.
  - It creates the booking, sends both emails, and is **idempotent**: store the Stripe session id on the booking with a unique index, so duplicate deliveries or a parallel `/success` call can't create two.
  - Make `/success` read-only: it only looks up the status of the booking for that session.
- **Needs from you:** adding the webhook endpoint and its signing secret in the Stripe dashboard.
- **Done when:** paying and closing the tab immediately still produces one booking and both emails.

### P0-3 `[Server]` `verifyPayment` double-responds, can hang, and fails on refresh
- **Status: DONE** as part of P0-2. Every request now gets exactly one response, every payment status is handled, an unknown session gives a 404, and refreshing `/success` shows the same confirmation. If confirmation fails, the page now tells the customer not to pay again and gives contact details.
- **Problem** (from reading the code):
  - If sending email fails, it sends a 500 and then falls through to `res.json(...)` again. The second send throws "headers already sent" inside the `catch`, which is an unhandled rejection and crashes the process.
  - If `payment_status` is anything other than `paid` or `unpaid`, no response is sent and the request hangs.
  - The "slot is still free" check (`availability != 12`) runs before the payment check. After a successful payment, refreshing `/success` reports "no availability", so a paying customer sees a failure message.
- **Fix:** Folded into P0-2: one status lookup, one response per request, every `payment_status` handled, safe to call repeatedly.
- **Done when:** refreshing `/success` shows the same confirmation, and an email failure never triggers a second response.

### P0-4 `[Server]` Cancelling a charter never frees the slot
- **Status: DONE in code (24 Oct 2026). Run the cleanup script against production when deploying** (see the go-live checklist in `CLAUDE.md`).
  - The seat-counting logic now lives once in `server/utils/availability.js` (it was copied in two controllers). A trip with an active charter booking shows 0 spaces, so cancelling the charter frees the trip and restoring it blocks the trip again. Nothing writes to the capacity setting any more.
  - Charters need a trip that is open and has no other bookings, instead of the hard-coded "exactly 12 free". A trip limited to 8 seats can now be chartered, and a closed trip (0 seats) can't.
  - Restoring a cancelled charter is refused while the trip has other bookings. Marking an existing booking as a charter (Edit, "Status") now blocks the trip, and marking it back frees it.
  - (The cleanup script `server/scripts/cleanup-charter-capacity.js` was deleted in P1-10: go-live uses a new empty database, so there is no old capacity data to repair.) It removed the old capacity rows that charters left behind (dry run by default, `--apply` to delete). It only deletes rows that match a charter booking on the same trip with the party size as capacity, and lists any other custom capacity for review. Dry run on the sandbox found nothing to remove.
  - Verified with 31 checks, and the earlier Stripe webhook and browser cancel/restore suites were re-run and still pass.
- **Problem:** A paid charter blocks the slot by overwriting the `Availability` capacity to the party size (`capacity: totalpax` in `verifyPayment`) and relying on `availability === 12` elsewhere. Cancel or delete the booking and the capacity override stays, so the slot never frees and that trip shows only the party's number of seats. This predates the cancel feature but the cancel feature makes it easy to hit. It also means charters stop working if you ever set a default capacity other than 12.
- **Fix:**
  - Work out availability as: a trip is full if there is an active charter booking for that date and slot; otherwise `capacity` minus active party sizes.
  - Stop writing to `Availability` for charters.
  - Replace the magic `12` with the real capacity.
  - Add a one-off script to remove old charter-caused capacity overrides.
- **Done when:** booking a charter fills the slot, cancelling it frees the slot, and restoring it fills the slot again.

### P0-5 `[Server]` Public endpoints can be abused to send email through your Gmail
- **Status: DONE** (24 Oct 2026, not yet deployed).
  - **Limits per IP address:** 10 booking attempts and 10 charter checkouts per 15 minutes, 60 availability requests per minute, 30 payment checks per 15 minutes. Stripe's webhook is never limited (its signature protects it).
  - **Limit per email address:** 3 booking requests per hour for the same address from anywhere, so bots can't use many IPs to email one victim.
  - **Hidden honeypot field** (`website_url`) on the public and charter forms. A request with it filled in gets a normal-looking reply and nothing is saved or emailed. It is off-screen, skipped by Tab and hidden from screen readers.
  - Email format and length limits on every customer answer (shared with the charter checkout), and the availability endpoint accepts at most 31 well-formed dates.
  - Customers who hit a limit see a clear message, and what they typed is kept.
  - Verified with 27 server checks plus a browser test of the form, and the earlier suites still pass.
  - Not done: a CAPTCHA (Cloudflare Turnstile). Add it if bots get past this. The counters live in memory, so they reset when the app restarts, which is fine for one dyno. Behind a shared IP (a guest house on Sark, say) the per-IP limit is generous enough that normal use won't hit it.
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
- **Status: DONE** (24 Oct 2026, not yet deployed).
  - The public booking is saved first and the emails go out after. If an email fails, the booking is kept and the customer is told it is reserved but their confirmation email couldn't be sent, so they should note the details. The owner's email then gets "CUSTOMER EMAIL FAILED, please contact them" in its subject.
  - The same rule applies to the dashboard's add and edit: a failed email is reported in the message, but the saved change is never turned into an error. (Cancel, restore and the charter webhook already worked this way.)
  - The success message no longer has stray spaces or line breaks.
  - Verified with 19 checks that fail the customer's email, the owner's email, or both on each flow, and the earlier P0-2 and P0-5 suites still pass.
  - Remaining gap: if Gmail is down, the owner alert email can fail too. The only trace is the server log and the saved booking in the dashboard. Error reporting (P1-9) closes that gap.
- **Problem:** In [addBooking](server/controllers/bookings.js) the confirmation and admin emails are sent first and the booking is created afterwards. If sending fails, the booking is never created, but the response says "Booking confirmed, but email sending failed". If creation fails after the emails are sent, the customer has a confirmation for a booking that doesn't exist.
- **Fix:** Create the booking first, then send emails. If an email fails, keep the booking, tell the customer it is booked and that the email failed, and email or flag the owner. Use the same order for the charter flow.

### P1-2 `[Customer]` The booking form shows nothing when the server rejects a booking
- **Status: DONE** (across P0-1 and P0-5). The public booking form and the charter form now show the server's message for every failure (validation, rate limit, no spaces, server error), with a friendly fallback if there is no reply, and keep what the customer typed. The form only clears after a successful booking.
- **Problem:** In [bookingForm.jsx](client/src/components/bookingForm.jsx) the public submit handlers only `console.log` on error. A 400 (incomplete), a 429 (once rate-limited) or a 500 leaves the customer with a form that silently does nothing. `ok: false` responses with a 200 status (no spaces left) are shown, but errors thrown by axios are not.
- **Fix:** Show the server's message for every failure, in the existing popup or inline, for both the normal and charter forms. Keep what the customer typed. Add a generic "something went wrong, please call or email us" fallback.

### P1-3 `[Server]` No server-side validation of dates, party size, timeslot or email format
- **Status: DONE** (24 Oct 2026, not yet deployed). All the rules live in `server/utils/validateBooking.js`.
  - **Public bookings and charter checkout** (same rules, as the owner chose): all fields required, valid email, length limits, a real calendar date, not in the past, inside the season (or "Bookings aren't open yet" if no season is set), trip time must be 11am or 2pm, adults a whole number from 1 to 12, children a whole number from 0 to 12. Online booking closes **1 hour before the trip starts**, measured in Guernsey time, not the server's UTC clock, and it handles the summer and winter clock change.
  - **Dashboard add and edit:** whatever is entered must make sense (real date, real trip time, whole numbers, valid email, booking type true/false), but details may be missing and past dates and dates outside the season are allowed. Editing only checks the fields that are filled in.
  - **Availability settings:** real date, real trip time, whole-number capacity from 0 to 100.
  - Values sent as lists or objects are rejected everywhere, as are prototype-style trip times like `constructor`.
  - Verified with 33 unit checks on a fixed clock and 41 checks through the real server. Every earlier suite was re-run and still passes.
  - Still hard-coded in that file (move to settings with P2-11): the trip times and their start hours, the 12 limit and the 60-minute cutoff.
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
- **Status: DONE** (24 Oct 2026, not yet deployed).
  - **Edits must fit.** Moving a booking to another date or trip, adding people, or making it a charter checks the destination first, ignoring the booking itself. If it doesn't fit, nothing is saved and the dashboard says "the 11am trip on 15-07-2026 has only 4 spaces left. Raise the trip's capacity first if you want to fit more people in." Taking people away or editing contact details never needs room, so an already over-full trip can still be edited. There is no overbooking override, by design: the boat can never legally take more than 12 (owner, 1 Nov 2026; the old P2-5 was dropped).
  - **"Email the customer about this change"** checkbox on the edit form, ticked by default. Unticked, the change is saved and the customer isn't emailed (the owner still gets a copy). It says so in the confirmation, and notes when there is no email address on file. Older callers that don't send the flag still email the customer.
  - **Details can be cleared.** An empty value now clears a name, phone, email, accommodation or message. A field that isn't sent is left alone, and the date, trip time and booking type can't be blanked. A blank adults box leaves the number alone so the seats aren't freed by accident; a blank children box means none.
  - A booking ID that doesn't exist (or is malformed) gets a clean 404 before anything else happens. Saving with no changes says so and sends no emails. The emails read sensibly for bookings with missing details (no "undefined"), and the customer's email shows the new date and time.
  - Verified with 38 server checks and a browser test of the edit form; every earlier suite was re-run and still passes.
- **Problem:** [updateBooking](server/controllers/bookings.js) doesn't re-check capacity when the date, timeslot or party size changes, so edits can overbook a trip. It always emails the customer and admin. Falsy values are ignored, so you can't clear a field such as accommodation. It builds the email before checking the booking exists.
- **Fix:**
  - Re-check availability for the new date, slot and size, excluding this booking.
  - Add a "notify customer" checkbox on the edit form, defaulting to on.
  - Allow empty strings.
  - Return 404 before building the email.

### P1-5 `[Server]` Customer text is put into HTML emails unescaped
- **Status: DONE** (24 Oct 2026, not yet deployed).
  - A new template tag, `safeHtml` in `server/utils/safeHtml.js`, escapes every value placed into an email's HTML while leaving the template's own tags alone. All 8 HTML email templates (booking confirmation, owner notices, update, cancel, charter confirmation and owner notice) now use it, so a value added to a template later is covered automatically. Missing values show as empty text instead of the word "undefined".
  - Hostile text is escaped, not rejected: the booking keeps exactly what the customer typed, and the email shows it as plain words (so a name like O'Brien & Sons prints correctly, and `<script>` just appears as the text "<script>").
  - Other places were already safe: the dashboard and the booking popup are built with React, which escapes text, and the email regex stops anything but a plain address in the "to" field. The plain-text owner alert for a charter clash needs no escaping.
  - Verified with 22 checks that send hostile names, messages, accommodation and phone numbers through every email-sending path (booking, dashboard add, edit, cancel, restore, charter payment) and inspect the raw HTML of all 10 emails. All earlier suites were re-run and still pass.
  - When the single mailer module (P2-10) is built, keep using `safeHtml` for every template.
- **Problem:** First name, message, accommodation and so on are interpolated straight into the HTML of the admin and customer emails. A customer (or bot) can inject markup or links into an email that comes from your address.
- **Fix:** One `escapeHtml` helper used by every template. This is easiest as part of P2-10 (a single mailer module).

### P1-6 `[Build]` Switching between local and production is a hand-edited URL, and the Stripe return URL is hard-coded to production
- **Status: DONE** (25 Oct 2026, not yet deployed). **Before deploying:** set `PUBLIC_URL=https://www.sarkboattrips.com` and `PRICE_ID` (the live price, `price_1QzL9TBMZ6qJyKg9hrBauqD6`) in Heroku. The full list is in the go-live checklist in `CLAUDE.md`.
  - **Browser to server:** `client/config.js` reads `VITE_API_URL`. `npm run dev` gets the local server from the committed `client/.env.development`; a production build leaves it empty, so the browser calls the site that served it and it works on any host. Verified: the production bundle has no `127.0.0.1`, `herokuapp` or `:4040`, and the development bundle has the local address.
  - **Stripe return address and email links:** one setting, `PUBLIC_URL`. Customers return to it after paying or cancelling, and the owner emails link to its `/dashboard`. A sandbox charter test now returns to the sandbox.
  - **Price:** read from `PRICE_ID` instead of being typed into the code.
  - **Test and live keys can't be mixed up.** Production uses `STRIPEKEY` (live). Everywhere else uses `STRIPETESTKEY`, and if only a live key is available, charter payments switch off with a clear message, so a laptop can never charge a real card. A missing or invalid `PUBLIC_URL` or `PRICE_ID` also switches payments off (customers get "Charter payments aren't available right now. Please contact us."), and the rest of the site keeps working. The startup log says which, and why.
  - The number of proxies in front of the app is a setting (`TRUST_PROXY`, default 1), and the build has a host-neutral `npm run build` script. `server/.env.example` lists every setting (this also covers part of P3-8).
  - Verified with 14 unit checks of the rules and server runs set up as the sandbox, a live-key-only laptop, and production, using fake keys and addresses.
- **Problem:**
  - [client/config.js](client/config.js) is switched by commenting lines in and out, and the wrong one is easy to commit and deploy.
  - [charters.js](server/controllers/charters.js) has `YOUR_DOMAIN` hard-coded to the Heroku URL. A charter test from the sandbox sends the customer back to the production site, whose `/success` verifies against the production database.
- **Fix** (as built, see the status above):
  - Use `import.meta.env.VITE_API_URL`, with `.env.development` (local) and none in production (use same-origin relative URLs, since the server serves the client, which also removes the need for CORS).
  - Read the domain and Stripe price id from environment variables (the unused `PRICE_ID` in `.env` was probably meant for this).
- **Done when:** nothing needs hand-editing to deploy, and a sandbox charter test returns to the sandbox.

### P1-7 `[Server]` Open CORS and almost no security headers
- **Status: DONE** (25 Oct 2026, not yet deployed). Everything is in `server/middleware/security.js`.
  - **CORS.** In production the website and the API are the same site, so **no CORS headers are sent at all** and no other website can read the API from a visitor's browser. Other sites are only let in if you list them in `CORS_ORIGINS`. When not in production, any page on your own computer (any port) and `PUBLIC_URL` are allowed so `npm run dev` always works. Before, `cors()` let every website in. (In practice this was low risk, because dashboard access is a token you send yourself, not a cookie a stranger's page could ride on, but it was still wide open.)
  - **Content Security Policy.** The browser may only load scripts from your own site, styles and fonts from your site and Google Fonts, frames from the Vimeo player, and talk to your own site and `vimeo.com`. It blocks everything else: no scripts from other sites, no inline code, no `onerror="..."` handlers, no `eval`, no sending data to other sites, no embedding other sites. Your site never loads Stripe's scripts (customers are redirected to Stripe's page), so Stripe isn't in the list.
  - **Other headers.** Frame protection (the page can't be embedded in someone else's site), `nosniff`, a sensible referrer policy (helmet's stricter default can break Vimeo), cross-origin isolation headers, a Permissions-Policy turning off camera, microphone, location, payment and USB, HSTS exactly as before, and the `X-Powered-By: Express` header is gone. `upgrade-insecure-requests` is only sent in production, because it would stop `http://localhost` pages loading.
  - **Safety switch.** If a deploy ever blocks something and you need the site back before fixing the policy, set `CSP_REPORT_ONLY=true`: the browser then only logs problems in its console and blocks nothing.
  - **If you add an outside service later** (an analytics script, a map, an image host, a chat widget), add its address to the policy in `security.js` or the browser will block it.
  - Verified with 40 header and CORS checks across production, local development, production with an extra allowed site and the report-only switch, and a real-browser run of the **production build** (served from the real server) over every page and the dashboard with nothing blocked, Google Fonts working, the Vimeo player embedding and its lookup succeeding, and the API called from the same site. It also simulated attacks: a script from another site, injected inline code, an `onerror` handler, sending data out and embedding another site were all blocked. All earlier suites still pass.
  - Not testable here: Vimeo's own player returns a 401 to automated browsers even on a page with no policy, so I couldn't watch the video actually play. Please play it once on the real site after deploying.
- **Problem:** `cors()` allows every origin, and helmet is only used for HSTS (no CSP, no frame or sniffing protection).
- **Fix:** After P1-6, restrict CORS to your own origins (or remove it if same-origin). Enable `helmet()` defaults with a CSP that allows Stripe, Google Fonts and Vimeo. Test the public pages and checkout carefully, because a too-strict CSP breaks embeds.

### P1-8 `[Build]` No tests and no CI
- **Status: DONE** (25 Oct 2026, not yet pushed). Run everything with `npm run check`.
  - **208 server tests** (about 10 seconds) cover: login and which routes need it, the date and booking rules with a fixed Guernsey clock, customer bookings and seat counting, the dashboard (add, find, edit, cancel, restore, delete), failed emails and email escaping, notes and season dates, the Stripe checkout, webhook and success page (one booking per payment even when eight copies arrive at once), payments switching off, security headers and CORS in each mode, rate limits, the real start-up path, and the cleanup script. Each file runs against its own throwaway in-memory database with a fake mailer and a fake Stripe, so nothing touches real data, email, keys or payments.
  - **31 browser tests** (about 40 seconds, Playwright) use the real website built exactly as production does: a customer booking, a refused booking keeping what was typed, the hidden bot field, charter checkout (including Stripe failing), the success page, the whole dashboard (login, add, edit, cancel, restore, delete, notes, season dates), nothing blocked by the security policy on any page, injected code being stopped, and no sideways scrolling on a phone.
  - **GitHub Actions** (`.github/workflows/ci.yml`) runs lint, the server tests, the production build and the browser tests on every push and pull request, on Node 22.11.0 (the Heroku version), and keeps the browser report if something fails. I could not run GitHub itself from here, so I simulated it: a clean copy of the project, Node 22.11.0, a fresh install and an empty cache, all steps in order. Everything passed.
  - **The tests really do catch breakage.** I broke the code on purpose in 15 ways (removing a login check, loading `.env` late, counting cancelled bookings, switching off email escaping, accepting any Stripe signature, removing the one-booking-per-payment index, opening CORS, removing the HTTPS redirect or the security policy, letting edits overbook a trip, ignoring the "don't email" box, and more) and every one made tests fail.
  - **Bugs the tests found along the way:** the login accepted a list such as `["owner"]` as the username and password (it still needed the right ones, but it was too loose); and a mistake I introduced in P1-7 made the server read `.env` too late, so a laptop ignored its Stripe settings. Both are fixed, and the second now has a test (`startup.test.js`) that runs the real server.
  - **Not covered, because it can't be tested automatically:** a real paid Stripe checkout, the Vimeo video playing, and real email delivery.
  - The first run of the suite was flaky (a database port clash when many test files started at once). It now retries and runs four files at a time, and passed 15 runs out of 15 in a row, including the worst case.
  - To keep it useful: **add a test with every change**, and when a known problem is fixed, delete its `test.fail()` marker (the last ones, in `known-issues.spec.js`, were fixed by P2-9).
- **Problem:** There are no tests, and the 108 lint errors mean lint isn't a usable gate. Every change is verified by hand.
- **Fix:**
  - Server API tests (supertest plus an in-memory MongoDB) for availability maths, public validation, auth gating, cancel and restore, and the charter and webhook flow with Stripe mocked.
  - Turn the Playwright setup I used into a small `e2e/` suite with a mocked mailer: booking, dashboard login, cancel and restore.
  - A GitHub Actions workflow running lint, tests and the build.
- **Done when:** a push that breaks booking or auth fails CI.

### P1-9 `[Server]` No error reporting, backup check, or separation of sandbox and production
- **Status: DONE for what the owner wanted** (25 Oct 2026, not yet deployed). Done: the sandbox has its own Atlas user (`sandbox-app`, `readWrite` on `Bookings-Sandbox` only; checked live: it can read and write the sandbox and Atlas refuses it the production `Test` database); a `production-app` user exists too (its details are commented out in the local `.env` until go-live); the connection address is built in `server/utils/database.js` from `atlasDB_user` / `atlasDB_user_password` (falling back to the original user and `atlasDB_password`, so production is unchanged until Heroku is given the new ones); outside production the server and scripts refuse to start unless `atlasDB_name` contains "sandbox"; `npm run backup` / `npm run restore` (see CLAUDE.md). **Skipped by the owner for now:** error reporting (Sentry etc.), so a crash is only visible in the Heroku logs. **Still to do at go-live:** give Heroku the production user and delete the old shared `morganguille` user. **Backups are still manual** (Atlas free tier has none): run `npm run backup -- --production` regularly, or move to a paid tier (M10) or another database.
- **Facts from the owner:** one Atlas cluster `BookingsDB` (free tier, no backups) holding `Bookings-Sandbox` (this sandbox) and `Test` (the live website's database, named by default).
- **Problem:** Everything is `console.log`, so you'd only learn about a failure when a customer tells you. Email failures are swallowed. I don't know whether Atlas backups are enabled. The sandbox and production databases appear to live on the same Atlas cluster and use the same database user.
- **Fix:**
  - Add error reporting (Sentry's free tier, or a Heroku log drain).
  - Notify the owner when a customer email fails.
  - Confirm Atlas automated backups and add an alert.
  - Give the sandbox its own database user restricted to the sandbox database.

### P1-10 `[Server]` Dates are stored as `dd-mm-yyyy` strings
- **Status: DONE** (25 Oct 2026, not yet deployed). Dates are now `YYYY-MM-DD` everywhere (bookings, availability, notes, the API, Stripe metadata) and shown as `dd-mm-yyyy` to people (emails, messages, screens) through one helper on each side. The owner chose a **clean break instead of a migration**: go live on a new, empty database and keep the old `Test` one as an archive, so there is no migration script and no mixed formats (steps in the go-live checklist in `CLAUDE.md`). The old `dd-mm-yyyy` form is refused by every route. The edit form's date box is now a date picker. The one-off charter cleanup script and its test were deleted: they only repaired old data. While there: sorting the dashboard no longer crashes on a booking with no last name.
- **Problem:** Strings in this format can't be sorted or range-queried correctly, so month views, reports, reminders and "upcoming bookings" are awkward or wrong. Every comparison is a string comparison. The same format is parsed in many places.
- **Fix:** Store `YYYY-MM-DD` (or a real Date at UTC midnight) for bookings, availability and notes. Write a one-off migration script with a dry-run mode and a backup, and keep dd-mm-yyyy for display only (one shared helper). Do this before the owner features in P2.
- **Done when:** the app works end to end on migrated sandbox data and a rollback plan exists, and `e2e/calendar-devices.spec.js` (out-of-season days blocked on Chrome, Android and WebKit, in several time zones) still passes. Don't parse date text in the browser: Safari reads some formats differently, and the time zone shifts UTC dates for visitors abroad.

---

## P2: improvements

> **Done (30 Oct 2026): the site now sends from `info@sarkboattrips.com` through Zoho, with SPF, DKIM and DMARC. Deploy it before the bulk-email features (P2-2) go live.** Original reminder:
> A burst of "your trip time has changed" or "your trip is cancelled" emails, all sent at once from a free `@gmail.com` address, is exactly what gets blocked or sent to spam, and customers need those emails to arrive. So the order is: P2-11 (one place for the sender address and contact details), then P2-10 (a proper email service and your own domain with SPF, DKIM and DMARC records), and only then P2-2. The same applies to the day-before reminders (P2-7) and the manage-my-booking emails (P2-6).

### Owner side

#### P2-1 `[Owner]` Monthly passenger and income CSV, and price settings
- **Status: DONE** (26 Oct 2026, not yet deployed). The owner dropped the printable day sheet (the dashboard on a phone does that job) and asked instead for a month's passenger totals and income, based on their own season spreadsheet. Built: adult, child and charter prices set in the dashboard's top row (infants free), shown on the public booking page instead of being typed into it; each booking saves the prices it was made at; a **Report** tab shows a month's adults, children, passengers, charters and income, and downloads them as a CSV (one row per day, then a total; dates day-month-year; cancelled bookings left out; charter passengers are counted in adults and children, and each charter earns the flat charter price).
- **Found on the way:** a customer could create a charter booking without paying by sending `charter: 'true'` to the public booking route (it copied every field the browser sent). The route now takes a fixed list of fields and a test guards it.
- **Not included:** the owner's costs (fuel, repairs), which stay in their spreadsheet; trip types such as half trips and fishing; the age wording "3-14 yrs" is still fixed text on the booking page.

#### P2-2 `[Owner]` Trip tools: change a trip's time for one day, close a trip, notify everyone on it
- **Partly done.** "Close a trip and notify everyone on it" is built as **Cancel a whole trip** (30 Oct 2026). **Change trip details** (31 Oct 2026, `trip-tools` branch, not yet merged): the owner moves one trip for one day to another time and/or to the **Maseline Harbour** (low tide), with an optional note; everyone on it is emailed the new details and a calendar file that replaces the old entry (the owner usually phones them first, so it can be switched off), and the owner gets one summary. The card charge, booking cutoff, reminder, confirmations, Stripe's page, the booking page, calendar panel and dashboard all follow the new time and harbour (`server/utils/trips.js`). The terms now say a customer who can't make a new time can cancel free, and that low tide may mean the Maseline Harbour.
- **Message everyone on a trip** (1 Nov 2026, `trip-tools` branch): the owner types a message on the dashboard and everyone booked on that trip gets it in the usual email style, with their booking details underneath; the owner gets one summary (who got it, who couldn't be emailed). Works on any day, including after the trip (a thank-you).
- **Extra trips** (1 Nov 2026, `trip-tools` branch): the owner adds a one-off trip to a day (a swim trip limited to 8, a shorter sunset trip) on the dashboard's **Extra trips** tab (next to Availability), with its own name, optional note to customers, time, harbour, seats, length and adult and child prices (infants free). Owner's decisions: it shows on the calendar and customers book it online straight away; it is sold by the seat, never as a charter (the charter page leaves it out); moving a booking onto or off an extra trip charges the new trip's price (between the usual trips a booking keeps the price it was booked at); one day at a time, no repeats; the 24-hour cancellation rule. **Edit** (added the same day) changes any detail: a new price applies to everyone booked on it who hasn't paid yet (owner's decision; the form warns how many first), a new time or harbour emails them as Change trip details does, and fixing the name, note, length or seats emails nobody. Deleting one is refused while anyone is booked on it (Cancel a whole trip first); with only cancelled bookings it is hidden rather than deleted, so they still show which trip they were. Emails, the calendar file (its own length), Stripe's page, the card charge, the reminder, the report and the other trip tools all follow it.
- The trip times and the 12 limit stay as they are: the owner doesn't need to change the usual times for a whole season.
- **Payments link:** done. The card charge reads the trip's time that day through `utils/trips.js`, so it moves with the trip (tested). P2-11 and P2-10 (email) were done first, as planned.

- **Change a trip's departure time for one day.** For example, it is rough at 11am, so the 11am trip goes at 12pm instead, and everyone booked on it is emailed the new time.
  - **Free choice of time.** The owner types any time, not a fixed list.
  - **Keep the trip, change its time.** The trip stays "the 11am trip" (that name is its identity in bookings, seat counts, charters and the calendar). A small new record says "on this date, this trip departs at this time". Nothing existing changes, there is no data migration, and a day with no record works exactly as it does today. Cancel, restore and charters keep working untouched. (Moving every booking onto a new "12pm" trip instead was considered and rejected: it would create a second trip next to the 11am one and everything would have to move with it.)
  - **New collection**, one record per date and trip: `{ date, timeslot, departureTime, previousTime, reason, changedAt }`, unique on date and trip. Time is stored as 24-hour `HH:MM` and shown the way the site shows times now (`12pm`, `12:30pm`). Valid times are real times within a sensible window, for example 06:00 to 21:00.
  - **Dashboard (Availability tab).** Pick the day on the calendar, choose the trip and the new time, optionally add a reason ("rough conditions this morning"). A preview comes first: "5 bookings will be emailed; 1 has no email address (name, phone), so you need to call them", plus a warning if the new time clashes with the other trip (the owner decides). Confirm saves the change and sends the emails, then reports "4 sent, 1 failed" and names any failures, with a way to resend to them. "Reset to normal time" saves the reset and emails everyone that the usual time is back. A badge on the day shows that a trip has a changed time.
  - **Customer email.** "Your trip on 15 July now leaves at 12pm instead of 11am (rough conditions this morning). Please be at Creux Harbour shortly before 12pm. If the new time doesn't suit you, just reply or contact us and we'll sort something out." Only active bookings are emailed, so cancelled ones are not. Anyone who books after the change sees and receives the new time straight away. Once P2-6 (manage-my-booking link) exists, the email also gets a cancel option.
  - **Everywhere a time is shown must use the new time**, not just the emails:
    - the booking cutoff in `validateBooking.js` (a trip moved to 12pm stays bookable until 11am)
    - the public calendar and booking form ("11am trip, now leaving 12pm")
    - the seat counts response the calendar reads
    - every email that mentions the time (about 20 places in `bookings.js` and `charters.js`)
    - the dashboard bookings table
    - the day sheet (P2-1) and the day-before reminders (P2-7)
  - **Save first, then email,** like the rest of the app: the change is saved before any email goes out, and a failed email never undoes it.
- **Close this trip.** One click sets capacity to 0, with an option to cancel the bookings already on it and notify those customers (for example a weather cancellation).
- **Notify everyone on this trip.** A time change, a weather cancellation and "close this trip" all need to email everyone booked on one trip, so build it **once** as a reusable function (preview the recipients, send with a template and an optional reason, report per-person success or failure, list anyone without an email address) and use it for all three.
- **Optionally** offer each customer a way to move to another trip.
- **Done when:** changing a trip's time saves the new time, emails exactly the active bookings on that trip once, shows the new time on the public calendar, form and every later email, enforces the cutoff against the new time, and resetting puts everything back. Test it with the fake mailer and a fixed clock, as in earlier items.

#### P2-3 `[Owner]` Month overview and better search
Bookings and guests per day and slot on the calendar, an "upcoming bookings" list, and search by email, phone and date range (today only last name works).
- **Status: DONE** (1 Nov 2026, committed on `version2`), from mock-ups the owner chose from:
  - **The calendar stays as it is** (owner: no guest numbers or bars on it, to keep the screen clear; the upcoming list does that job).
  - **Upcoming bookings:** a Day / Upcoming switch on the Bookings tab. Every booking from today (Guernsey time) for the next 7 days (the owner's default), 14, 30 or all upcoming, grouped by day with each day's bookings and guests; each row shows time, name and reference, party, payment and amount, email and phone. **Open day** shows that day's table (with Edit, Mark paid, Cancel) and moves the calendar to it (`MyCalendar` takes `value`). `GET /bookings/upcoming?days=7|14|30|all`.
  - **Search:** one box for first or last name, email, phone (spaces, +44 and the leading 0 ignored) or reference, plus optional From / To dates; with only dates it lists everything in between. Results use the same grouped list. What is typed is matched as plain text (it used to be used as a pattern, so a stray `(` or `.*` misbehaved). `GET /bookings/search?q=&from=&to=` (the old `/bookings/search/<text>` still works). At most 500 results.
  - Tests: `server/test/search.test.js`, two tests in `e2e/dashboard.spec.js`.

#### P2-4 `[Owner]` Card saved at booking, charged at the trip time
Decided with the owner on 26 Oct 2026 and written up in **`paymentsspec.md`**: every online booking saves a card on Stripe's hosted page (nothing charged), the card is charged automatically at the trip's start time, the owner cancels in the dashboard first for weather so nothing is ever refunded, a failed charge just shows the booking as Unpaid, and the £80 charter deposit goes away. Open: how the timer runs (recommended: a timer inside the app). Builds on P2-1's prices. Still wanted alongside it: a note on each booking, and a "cancel everything on this trip" button (P2-2) so a weather call is one tap.
- **Status: DONE** (30 Oct 2026, merged into `version2`), in five steps plus the trip-wide cancel; details and what was checked against real Stripe test mode are in `paymentsspec.md`.

#### P2-13 `[Owner]` Customer data tools
One place to find everything held for an email address, export it, and erase it (permanent delete already exists per booking). Update the privacy policy's retention paragraph to state that cancelled bookings are kept until a customer asks for removal, which is current practice.
- **Done** (3 Nov 2026, on `version2`, not yet deployed). Owner's choices: erase **blanks** the details (keeps date, party and money so reports stay right), **removes the saved card at Stripe**, and lives on the **Bookings search** (search an email, then Customer data). Download is a JSON file. Erasing is refused while they have a booking today or later, a charge in progress, or a voucher still to be emailed to them. The privacy policy already said cancelled bookings are kept until asked; it now also says what is kept after erasing. Not covered: the owner's Notes, their inbox, and local backups (`backups/`), which keep old copies until replaced. See CLAUDE.md. Tests: `server/test/customers.test.js`, `e2e/dashboard.spec.js`.

#### P2-14 `[Customer]` Mobile-friendly pass over the whole website **DONE (1 Nov 2026, `mobile-pass` branch)**
Most customers book on a phone (owner, 1 Nov 2026). Every page was checked at 360px on Chrome, an emulated Android phone (Pixel 7) and WebKit (iPhone 14). Fixed:
- **Success and "Booking not made" pages were cut off at the top and the bottom** (the owner saw it on their Android): `.stripe-landing` in `App.css` had a fixed `height: 85vh` and 60% width. Now `min-height`, top padding to clear the menu button, full width with a 16px edge, text left-aligned on phones, the buttons full width, and the email, WhatsApp and terms links underlined.
- **Review links** ran off both edges of the screen on phones. Redesigned (owner chose option D of five mock-ups): one white panel with the overall 5.0 and stars at the top, then a row per site (Google, Tripadvisor, Facebook) with its score and an arrow, like a phone's settings list; rows at least 44px tall. `components/reviews.jsx`, `css/reviews.css`.
- **The menu's section links (The tour, Charters...) were dead on every page except home** (bookings, terms, privacy, manage, 404): they now go to `/#theTour` etc., and the home page scrolls to the section (`App.jsx` used to jump back to the top).
- **Terms and privacy pop-up** (later removed: the footer now links to the `/terms` and `/privacy` pages): a Close button that stays at the top while the text scrolls (before, only tapping outside closed it), left-aligned text, and on a phone it fills the screen with a 16px edge.
- **Booking form steps out of line:** on phones over 360px wide and tablets, "1 Choose a day" started further in than steps 2 to 4 (the calendar column was 22rem, the form 32rem, both centred). Below 900px the calendar column is now as wide as the form (`.bookingsSide` in `bookings.css`).
- **On the owner's Android phone the dashboard greyed out days outside the season** (found 1 Nov 2026 through ngrok; the laptop was fine). Not a date bug: the code compared the page address exactly, and the router also opens the dashboard for `/Dashboard` or `/dashboard/` (the phone capitalised or added a slash), so the calendar took it for a customer page. `/Charters` likewise showed the trip form instead of the charter one. Every address check now goes through `usePage()` (`hooks/usePage.js`: lower case, no trailing slash). Tests in `dashboard.spec.js` and `public.spec.js`.
- **Dashboard season dates and prices were jumbled on a phone** (the owner's Pixel 8 Pro: dates wrapping onto separate lines with Android's arrows, prices running into each other). On a phone each is now one row with the label in its own column: the two dates side by side as text while locked ("1 May 2027 → 30 Sep 2027"; Android drew the locked date boxes wider and cut the dates off, so the boxes only show while editing), and the three prices as columns (name above, price below). Editing keeps the boxes stacked under the label. `seasonDatesForm.jsx`, `pricesForm.jsx` (`.settingValues`), `dashboard.css`.
- **Dashboard: a Trip tools tab** (owner, 1 Nov 2026: the Bookings tab was cluttered). Change trip details, Message everyone on a trip and Cancel a whole trip moved from under the bookings list to their own tab next to Bookings; they act on the day picked on the calendar, and during a search the tab offers Back to the day. Test in `dashboard.spec.js`.
- **The menu button (☰)** floated over the text with nothing behind it: now a pale tile.
- **Dashboard on a phone:** each booking is a card (a heading next to each detail, `data-label` on the cells; empty lines left out) with Edit, Mark paid and Cancel in a row underneath, so nothing needs a sideways swipe; boxes 16px (iPhones zoomed in on the 15px ones); buttons at least 40px tall.
- Tests: `e2e/mobile.spec.js` (every page: no sideways scrolling, heading below the menu button, no text under the footer, 16px boxes; plus the success page, reviews, menu links, pop-up and dashboard cards), run on Chrome at 360px and on the Android and iPhone projects. It replaces the old 390px sideways-scroll test in `public.spec.js`, which missed the review cards.
- Not changed (the owner may want to look): the charters page's long bold, centred paragraph above the booking form, and the big gaps around the photos on the home and charters pages. Still worth a check on a real iPhone before go-live (WebKit is the same engine but not a real phone).

#### Header and footer redesign `[Customer]` **DONE (1 Nov 2026, committed on `version2`)**
From mock-ups the owner chose from:
- **Header, option A:** logo and name on the left (home), The tour, Charters, Sark Island, Reviews (all go to sections of the home page: Charters briefly opened the charter page, which the owner found jarring next to links that scroll), and a gold Book a trip button. See-through over the home page's photo, white once you scroll and on every other page. The same on every page (charters, success and canceled used to show only HOME). It is fixed from the start (it only stuck after 850px before).
- **Phone:** a slim white bar with the logo, a gold Book button and a menu button; the menu covers the screen with big rows, Book a trip, the phone number and email, and closes on a link, ✕ or Escape. **Bug fixed:** the old menu stayed open over the page after a link was tapped.
- **Footer:** the owner's line ("Discover Sark from the sea. Guided boat tours with local skippers."), Book a trip, contact (call or WhatsApp, email; no address, owner: nowhere to visit), page links, social logos in white circles (Facebook and Tripadvisor were nearly invisible on the dark grey). Terms and privacy go to their own pages; the pop-ups are removed.
- Found on the way: on the iPhone engine, a link to a home-page section stopped short, because three photos without a size pushed the page down as they loaded during the smooth scroll. They now have their sizes.
- **The page jumped on the owner's phone while scrolling past the hero:** the hero was sized `100dvh`, which follows the address bar as it slides away, so the hero changed size mid-scroll. Now `100svh` (the screen with the address bar showing), which stays put. Test in `mobile.spec.js` (checks the unit: an emulator can't slide a real address bar).
- The phone number is now one setting in `client/src/utils/contact.js`, used by the header, footer, success, canceled, manage, terms and privacy pages.
- Tests: `e2e/header-footer.spec.js` (laptop), and the menu, phone header and footer tests in `e2e/mobile.spec.js`.
- **The home page video** (owner, 1 Nov 2026: no autoplay, for people on data): a round gold "Watch a trip · About 1 minute" button in the corner of the cover (it sat on the title), the cover filling a 16:9 frame (no black bars or dimming), "Plays only when you tap it" underneath. Tapping loads Vimeo's normal player (the old one was background mode: always silent, no controls, an invisible click-to-pause layer) with its controls, music quiet (volume 0.15; iPhones use the phone's volume), and Vimeo's do-not-track. The Vimeo code (43 KB) is now fetched by the tap instead of with every visit. Tests in `public.spec.js` and `mobile.spec.js`; the playing itself can't be tested (Vimeo blocks automated browsers).
- **Charters redesign** (from mock-ups, owner's answers 1 Nov 2026): the home page section has the cave photo beside short text, fact chips (up to 12 people, about 3 hours, the price) and a gold button to the charter page. The charter page opens with the Derrible photo, "Private charters" and **Check dates** (jumps to the form), then a facts strip (price, up to 12, about 3 hours but flexible, free cancellation 48 hours before), the four ideas as photo cards, Good to know (paddleboards and snorkelling gear included; packed lunch for extra, by arrangement; other times on request) and Booking and paying, and a contact strip. **The price on both comes from the dashboard** (owner: so it can't be forgotten). The long bold paragraph is gone. Photos: the owner may send newer ones; the evening card uses a coastline shot for now.
- **Home page redesign** (owner, 2 Nov 2026, from mock-ups): every section below the photo now uses the charters style (small green label, sentence-case heading, the 72rem column). The tour: four quick facts (2½ hours, 11am and 2pm, max 12, the adult and child prices from the dashboard) and three photo cards (seabirds, dolphins and seals, caves). Reviews moved up after the tour, "Rated 5 stars" with three quotes the owner chose (swiped on a phone) and the site links. The boat: "Meet the Dorado" with her photo. The slideshow became a clean row of photos at their own shapes, moved by dragging, arrows or a swipe, never by itself (the old one hid its arrows, skipped a photo on every click and had no descriptions). Sark Island cut to two cards (coming for the day, Sue's B&B, with tappable links). RESERVATIONS replaced by three paying points in the booking section (on every page that has it). New photos from the owner: the Dorado, the charter swim (home page charters), the charter page's main photo (title at the top; on a phone Check dates at the bottom) and the Beach explorer card. Also fixed: the home photo's heading and Book now went off screen with a phone held sideways; typos (teeming, Gouliot). Tests in `public.spec.js`, `mobile.spec.js`, `header-footer.spec.js`.

### Customer side

#### P2-6 `[Customer]` Manage-my-booking link
- **Done** (1 Nov 2026, `manage-booking` branch, not yet deployed). Owner's decisions: up to the free-cancellation deadline (24 hours, 48 for charters; until the trip starts if the owner moved its time) customers can **cancel** and **add or remove people** (adding needs the seats); a different day or time is a **message** to the owner; after the deadline the page shows the contact details only; a paid booking can't be changed online; phone bookings with an email get the link too; every change emails the owner. Every booking has a short reference (`SBT-7K3F9Q`) shown in emails and on the dashboard (searchable). The terms now point to the link. See CLAUDE.md ("Manage my booking"). Tests: `manage.test.js`, `e2e/manage.spec.js`.
A signed link in the confirmation email where the customer can view their booking and cancel it (up to a cutoff you choose) or request a change. It cuts down on phone calls and emails.

The "your trip time has changed" email from P2-2 should include this link, so a customer who can't make the new time can cancel straight from the email. (Until this exists, that email just asks them to reply or contact you.)

#### P2-7 `[Customer]` Reminder email the day before
- **Status: DONE** (30 Oct 2026, not yet deployed). `server/utils/reminders.js`, run every minute by `index.js` (the same in-app timer as the card charges, not Heroku Scheduler, so it needs the dyno awake like the charges do). Owner's decisions: sent at **6pm Guernsey time the evening before**, to **every booking with an email** (online and dashboard, trips and charters, not cancelled), **not** to a booking made after 6pm for the next day (it has only just had its confirmation), and **no payment line**. Content: day, time, party, be at Creux Harbour shortly before, what to bring, the weather note, and how to get in touch. Sent once (`reminderSentAt`, claimed before sending so two checks can't both send), a failed send is retried a minute later up to 3 times, a reminder missed by midnight isn't sent the next morning, and moving a booking to another day resets it. Tests: `reminders.test.js`.
- Original notes: meeting point, what to bring and a weather note. It reduces no-shows.

#### P2-8 `[Customer]` Booking form polish
- **Done** (1 Nov 2026, `booking-form` branch, not yet deployed). A new customer form, phone first (owner's choices: trip cards and − / + buttons, no summary bar): the day's trips as cards with the seats left (full or closed trips can't be picked), party buttons that stop at the seats left, a running total, inline error messages instead of the pop-up, 16px boxes so iPhones don't zoom, what they typed kept after an error or after coming back from Stripe, past days blocked on the calendar, the calendar opening on the first bookable day, and on wider screens the calendar stays in view while the form scrolls. The home page's out-of-date "pay on the day" text was corrected. The "add to calendar" file was already in the confirmation email; the success page is the summary. See CLAUDE.md.
- Show the price total as the party size changes.
- Disable past days and days outside the season on the calendar (the hard-coded "Prices for 2026" text needs to come from config, see P2-11).
- Keep entered data after an error.
- Show a confirmation summary and an "add to calendar" file.

#### P2-15 `[Customer]` Gift vouchers
- **Done** (2 Nov 2026, `gift-vouchers` branch, not yet merged). Before: the owner took a bank transfer and emailed a plain PDF with no code, name or expiry. Owner's decisions (option B of the mock-ups): a **Gift vouchers page** (`/gift-vouchers`) where the buyer picks adults and children at the normal dashboard prices, or a **private charter**, adds who it's for and a message, and has it emailed to themselves or to the person it's for, now or at 8am on a day they choose; **paid at once** on Stripe's page (mode `payment`, unlike bookings). Vouchers are **for people, not money**, valid until **1 October of the next season to start** (the season always ends by then), **not refundable but can be passed on** (on the voucher, the page, Stripe's page and the terms, section 10). The voucher is a PDF (the hero photo, name, message, what it covers, code `GIFT-XXXX-XX`, expiry) attached to the email. The owner gets an email per sale. **Dashboard Vouchers tab:** list and search, make one by hand (bank transfer, cash or a free prize), **Use** with a booking reference (the voucher's value comes off what the booking owes; a voucher covering it all marks it `voucher`, so a saved card isn't charged), Undo, Email again (to a corrected address), Extend, PDF. Using a voucher online (option C) was left for later. **Report:** vouchers sold (and their money) and used that month; a trip paid by voucher only counts what was left to pay, so money is counted once, when the voucher is sold. My choices, worth the owner confirming: a voucher for more people than came is used up; a customer can't change or cancel a voucher booking themselves (the owner does, then presses Undo). Tests: `vouchers.test.js`, `e2e/gift-vouchers.spec.js`.

### Back end and build

#### P2-9 `[Client]` Each public route prerendered separately
- **Status: DONE** (1 Nov 2026, committed on `version2`). The owner's prerender (home page only) now builds every public page to its own file: `/`, `/bookings`, `/charters`, `/terms`, `/privacy` each arrive with their own HTML, title and description, and React no longer rebuilds them (the four `test.fail()` markers in `known-issues.spec.js` are now ordinary passing tests in `e2e/seo.spec.js`). The dashboard, success, canceled and manage pages get an empty page marked `noindex`, built in the browser. An address that isn't a page now answers **404** (it used to be the home page with 200, which search engines count as a duplicate). `robots.txt` (keeps out `/dashboard` and `/manage/`, points to the sitemap) and `sitemap.xml` (the five public pages) are made by the server from `PUBLIC_URL`. Found on the way: the template's description tag spans several lines, so the prerender never replaced it and every page had the home page's description; fixed, and the bookings, terms and privacy pages got descriptions of their own. Tests: `server/test/pages.test.js`, `e2e/seo.spec.js`.
- Not done: a `canonical` link per page (would need `PUBLIC_URL` at build time); the home page's title is the short "Sark Boat Trips" from `home.jsx`, as before (the template's longer one is replaced).
- **Problem (to verify, from reading the code):** [prerender.js](client/prerender.js) renders only `/` and the server returns that same `index.html` for every route. On `/charters` or `/bookings`, the HTML is the home page, which then fails to match what React renders on load, so React logs a hydration error and re-renders. Search engines also see the home page's markup and title for those routes.
- **Already written as tests (history):** `e2e/known-issues.spec.js` expected the pages other than home to fail; with the fix they became ordinary tests in `e2e/seo.spec.js` and the file was removed.
- **Fix:** Prerender each public route to its own file and have the server serve the right one. Add `sitemap.xml`, add `Disallow: /dashboard` to `robots.txt`, and a `noindex` meta tag on the dashboard, success and canceled pages.

#### P2-10 `[Server]` Move off Gmail SMTP
- **Status: DONE** (30 Oct 2026, not yet deployed). The owner chose Zoho Mail Lite (about £10 a year) over a transactional service: `info@sarkboattrips.com`, with the domain's DNS at Squarespace holding Zoho's MX, SPF (`include:zohomail.eu`), DKIM (`zmail._domainkey`) and DMARC (`p=none`, reports to info@; tighten to `quarantine` after a few clean weeks) records. The site sends through `smtp.zoho.eu` with an app password (`SMTP_*` settings); a real test email went through. Zoho's sending limit is far above the site's needs. If emails ever start landing in spam or volumes grow, ZeptoMail (Zoho's transactional service), Postmark or Resend are a settings change away (`SMTP_HOST` etc.). The emails were then redesigned (30 Oct 2026): one shared, email-safe layout in `server/emails/` with a plain-text copy, the logo embedded, dates written out, a details box, calm subject lines for customers and who/how many/when subjects for the owner, and an "add to calendar" file on confirmations and changes. Left for later, by the owner's choice: a booking reference (with P2-6, manage my booking).
- Original notes:
**The owner plans to leave the free `@gmail.com` address soon** (it gets blocked and lands in spam). `sarkboattrips@gmail.com` is hard-coded about 30 times: 24 in the booking and charter controllers (as sender and as the owner's own address), plus the success, canceled, footer and privacy pages, and the SMTP login in `.env`. Do P2-11 first (one place for the sender address, owner address and contact details), then switch. **Do both before P2-2 (changing a trip's time and notifying everyone on it)**, which sends many emails at once. With a custom domain, also set up SPF, DKIM and DMARC records so the emails aren't treated as spam.
Gmail SMTP has daily sending limits, weaker deliverability (your own email asks customers to check spam), and it ties delivery to one personal account. Use a transactional service (Resend, Postmark or SES) behind one `mailer.js` module that also holds the three email layouts now copied across the code, the HTML escaping (P1-5), and failure alerts to you.

#### P2-11 `[Server]` Business settings hard-coded in many files
- **Closed** (owner, 2 Nov 2026): the usual trip times stay as they are, now that extra trips (P2-2) cover anything different, and 12 is the boat's legal limit, so neither needs to be a setting.
- **Partly done** (30 Oct 2026, not yet deployed): **email addresses.** The server reads `MAIL_FROM`, `OWNER_EMAIL` and the mail server from its settings (`settings.mail`), the website pages use `CONTACT_EMAIL` (`client/src/utils/contact.js`), and `email-settings.test.js` fails if the old Gmail address comes back. Prices and the Stripe price id were done in P2-1 and P2-4. **Still to do:** the trip times (`'11am'`, `'2pm'`), the 12 limit and the phone number (now in one place for emails, `server/emails/layout.js`, but still typed into the website's pages); best done with P2-2 (changing a trip's time).
Timeslots (`'11am'`, `'2pm'`), default capacity 12, prices and the "2026" text, the Stripe price id, the domain, and the email addresses are scattered across files. Put them in one server config plus a small settings document editable from the dashboard, and have the client read them.

#### P2-12 `[Server]` Overbooking race condition
- **Done** (1 Nov 2026, `trip-tools` branch, not yet deployed). More important once the owner confirmed 12 is a legal limit: a test showed two customers saving cards at once could put 14 on a 12-seat trip, or two charters on one trip. Now everything that adds people to a trip (online bookings, dashboard add, edit and restore) checks and saves inside `withTripLock` (`utils/availability.js`), one at a time per trip, so the second sees the first and gets the existing "trip filled up" booking (cancelled, nothing charged, customer and owner emailed). The lock is in memory, which suits the single Heroku dyno; running more than one copy would need a database-level guard instead. Tests: `overbooking.test.js`.
Booking checks availability and then creates the record, which isn't atomic. Two customers submitting at once for the last seats can both succeed. Fix with a re-check after insert (undo if over capacity) or an atomic per-slot counter. Low risk at your volume, so do this after the other server work.

---

## P3: tidy-up and later

- **P3-1 `[Build]` Untrack build output: DONE** (3 Nov 2026, on `version2`). `client/dist` and `client/dist-server` (31 files, out of date: they still held a deleted photo) are no longer kept in git and are in `.gitignore`. Heroku already built them on every deploy (`heroku-postbuild`; vite is a normal dependency, so it is installed there), so nothing changes at deploy. Without a build the server's pages now say "The website hasn't been built yet" instead of a vague error (`pages.test.js`).
- **P3-2 `[Build]` Lint baseline: DONE** (25 Oct 2026, as part of P1-8). Lint now shows 0 errors (it was 116 problems). Most were in generated build output (`dist-server`) that was being linted by mistake, plus 68 PropTypes complaints for a rule this project doesn't use (now off). The rest were unused `React` imports, a few unescaped apostrophes in page text, and one unused import; the deprecated `.eslintignore` was removed. 7 warnings remain on purpose (a calendar effect, a navbar effect, and four "only export components" hints). `npm run lint` is part of CI.
- **P3-3 `[Server]` Models: DONE** (3 Nov 2026, on `version2`). Indexes on bookings `{date, timeslot, status}` (the day view, seat counting, the month's report), availability `{date, timeslot}` and notes `{date}`; the server builds them itself when it starts (quick and harmless on the sandbox; the new production database gets them on its first start). Bookings' `children` and `infants` default to 0, also when an older booking without them is read. `adults` has no default: a dashboard booking may leave the party blank, and every sum already treats a missing number as 0 (`seatsFor`, the report, the manage page), so there was no `NaN` to fix. Availability isn't made unique on day and trip: only the owner writes it, and a duplicate would stop the server building the index. Tests: `models.test.js`.
- **P3-4 `[Server]` Responses and errors.** Many endpoints return 200 with `ok: false`, and the response shape varies (`data`, `message`, `error`). Pick one shape, use real status codes, and add the global error handler from P0-1. Consider an `/api` prefix on the routes so API paths can't be confused with client routes.
- **P3-5 `[Client]` Components and CSS: DONE** (3 Nov 2026, on `version2`). The dashboard booking form's bare `form div`, `form select`, `form button`, `form textarea` and `form p` rules now apply to that form only, and the bare `input` rule to the dashboard only. Checked with before-and-after screenshots of every page, the booking steps, the manage page and every dashboard tab and form, at laptop and phone width: identical, apart from the Availability tab's explanation, which the old rule squeezed to 300px and now fills the box. The pay buttons on the booking and gift voucher forms had been getting their white text and no border from the old rule; they now set them themselves. The site-wide paragraph margin (screens up to 1366px) was kept and moved to `App.css`. The "not a <form>" workarounds' comments were removed. Test: `public.spec.js` (a new form starts plain). Original note: Split `BookingForm` (it handles public bookings, charters and the dashboard) into form pieces that share fields. (The duplicated date helpers in `bookings.jsx` and `myCalendar.jsx` were removed in P1-10.) Namespace the global CSS rules (`form div`, `form button` in `bookingForm.css`, `input` in `dashboard.css`) so styles can't leak between pages.
- **P3-6 `[Owner]` Dashboard niceties: DONE** (3 Nov 2026, on `version2`, from a mock-up; the owner chose what to build). **Undo after Cancel:** a bar says Booking cancelled with Undo for 30 seconds; the cancellation emails wait about a minute (kept in the database, so a restart doesn't lose them), so Undo in that time puts the booking back and nobody is emailed at all (owner's option A). **In-page "are you sure?" boxes** replace every browser pop-up on the dashboard (cancel, restore, mark paid, undo paid, delete for good, move, message and cancel a whole trip, add, save and delete an extra trip) and on the customer's manage page (owner: yes); they show the booking, say who is emailed, and have buttons that say what they do. Found while building: the box sat in the top corner on a laptop (the site's margin reset), now centred and tested. **Log out checked:** it works; other tabs now log out at once instead of at their next click; for a lost device, change `JWT_SECRET` on Heroku (written in CLAUDE.md). **Not wanted (owner, 3 Nov 2026):** remembering the selected tab, "log out everywhere", two-factor sign-in. Not added: Undo after other actions (Mark paid has Undo paid; trip moves email everyone at once). **Also fixed (owner's screenshot, 3 Nov 2026):** on a laptop the bookings table could be 30px too wide, cutting off the buttons, when a booking had a long email address and a card label (it was so before P3 too); the email may now go onto two lines at the @ and the card label before "(expires". In a narrower window (about 1020 to 1250px wide, the calendar still beside it) the table still scrolls sideways.
- **Photos enlarge (owner, 5 Nov 2026, on `version2`): DONE.** A click or tap on a home page photo fills the screen with it on a dark background, photo only (owner: no description), with arrows and keys on a laptop, a swipe on a phone, pinch zoom, and Escape, the ✕ or the dark area to close. Dragging the row still only scrolls it.
- **Video in the photo row (owner, 5 Nov 2026, on `version2`).** The owner felt the photo row was in the wrong place. The video is now the first item in the row, the same height as the photos, and the row sits where the video was, under the main photo. From a mock-up, the owner's choices: the first tap plays it at the small size, on the page; a second tap on the picture opens it in the lightbox from the same moment; closing keeps it playing small; out of sight it pauses. Nothing comes from Vimeo before the tap. The row's position is provisional: the page order is still to be decided. Not checked: the real Vimeo player (the tests use a stand-in), its control bar at the small size, and the blink when moving between sizes. The owner checked the real player on their phone and laptop, 5 Nov 2026: sound and volume, pause and sound buttons, the blink and resuming after the lightbox are all fine.
- **Video paused out of sight won't resume small `[Customer]`: OPEN** (owner, 5 Nov 2026). Swipe the playing video away and back: pressing play on its control bar doesn't resume it, the tap opens the lightbox instead. Probably Vimeo shows its play button higher up once paused, under the see-through button (`.videoEnlarge`), which stops above the control bar. Not yet looked into.
- **P3-7 `[Customer]` Accessibility pass: DONE** (3 Nov 2026, on `version2`). axe (`@axe-core/playwright`) now checks every page, the booking steps, the manage page and every dashboard tab at laptop and phone width (`e2e/accessibility.spec.js`). It found one real problem everywhere: white words on the gold and green buttons scored about 2.3 for contrast (4.5 needed). The owner chose option C from a mock-up: dark navy words on the gold (5.6, hover lighter), and a deeper green (`#047857`, 5.5) with white words; blue links and hovers a shade darker. Later the same day the owner chose, from a second mock-up of six colours, **sunny yellow** (`#f5c242`, navy words, score 7.6, hover `#f8d06b`) for the Book buttons in place of the gold; the green pay buttons are unchanged. The gift voucher PDF keeps its thin gold stripe. Also: the phone's sideways reviews row can be reached by keyboard, and calendar days get a clear outline when moved through with the keyboard (they only changed shade). A keyboard walk of the customer pages found every other control already showed its focus. Not changed: each calendar day is its own Tab stop (about 30 presses to pass the calendar; that's the calendar component's own behaviour). Still worth doing before go-live: a quick try with a real phone screen reader (VoiceOver or TalkBack). Original note: Run axe in the Playwright suite, then check calendar tile contrast, focus order and screen-reader announcements.
- **P3-8 `[Docs]` README and `.env.example`.** **Done** (26 Oct 2026): the README now has setup and environment instructions, and `server/.env.example` lists every setting. Still open: the owner's own `.env` has an unused PostgreSQL block (`DB_*`) that can be deleted.

---

## Code review (9 Nov 2026)

A read-through of all the server code and the main website logic (booking form, calendar, dashboard page), looking for errors and repeated code. Not read: the CSS, the tests, the home page photo and video code, most of the individual dashboard panels. **[verified]** means it was reproduced against a throwaway test database or the running site; the rest come from reading the code.

### Fixed on the `review-fixes` branch (9 Nov 2026, not yet merged or deployed)

Each has a test that fails without the fix (checked by breaking the fix on purpose).

- **R-1 `[Server]` An online charter could be booked for up to 36 people [verified]: DONE.** Each box allowed 12 (adults, children, infants) and nothing checked the total; a trip was stopped by its seats, a charter by nothing. The form already stopped at 12, so it took a request made by hand. Now `validatePublicBooking` refuses any customer booking of more than 12 in all ("The boat takes up to 12 people, infants included. For a bigger group, please contact us."). Test: `checkout.test.js`.
- **R-2 `[Server]` Stripe receipts named the trip wrongly [verified]: DONE.** The charge's description used the booking's `timeslot`, so an extra trip's receipt read "Sark Boat Trips trip xec7522 10-11-2026" and a moved trip showed its usual time. It now reads as the saved card's description does: "Sark Boat Trips Swim trip 4:30pm 10-11-2026", the time the trip really left, "charter" for a charter (`chargeDescription` in `utils/charges.js`). Test: `charges.test.js`.
- **R-3 `[Server]` The site was sent uncompressed and never kept by the browser [verified]: DONE.** The main script was 465KB on the wire (149KB compressed) and every photo was asked for again on every visit. Now pages, scripts, styles and API answers are compressed (the `compression` package, a new dependency), and everything in `/assets` (whose names change when the files do) is kept by the browser for a year; pages are still checked every visit, so a release shows at once. Test: `pages.test.js`.
- **R-4 `[Owner]` A gift voucher stayed "used" when its booking was cancelled, and nobody said so: DONE (the reminder; the voucher is still freed by the owner).** Cancelling on the dashboard now says which voucher to free (in the message and in the owner's email, also when the voucher only paid for part of the booking), "Cancel a whole trip" lists every voucher to free in its message and its summary email, and the customer's email says their voucher hasn't been used up whether it paid for all or part. **Not done, a choice for the owner:** freeing the voucher automatically on cancel (then Undo and Restore would have to take it again). Test: `vouchers.test.js`.
- **R-5 `[Owner]` Customer data: where they were staying was missed: DONE.** `accommodation` is now in the file sent to the customer and is blanked by Erase. Test: `customers.test.js`.
- **R-6 `[Server]` A card saved after the trip had left made a booking that was charged at once: DONE.** The one hour cutoff was only checked when the customer started, and Stripe's page stays open for a day. Now such a booking is kept as cancelled ("Not booked: the trip had already left when they saved their card. Nothing was charged."), nothing is charged, and both sides are emailed (`tripFullEmail` and `tripFullOwnerEmail` with `left`). The owner can restore it if they did come. Test: `checkout.test.js`.
- **R-7 `[Server]` Emails had no time limit: DONE.** The success page and Stripe's webhook wait for the confirmation and the owner's alert; with the mailer's own limits (minutes) a stalled mail server would hang the customer's page. The mailer now gives up after 10 seconds to connect and 20 while sending, and the send counts as failed (reported as any failed email is). Test: `email-settings.test.js`. Not proved: how the real Zoho server behaves when slow.
- Also removed: two unused imports in `controllers/bookings.js`.

### Also fixed on `review-fixes` (9 Nov 2026, not yet merged or deployed)

Again each has a test that fails without the fix.

- **R-8 `[Customer]` Each tap on a calendar day reloaded the whole month: DONE.** `myCalendar.jsx` now asks for the month only when the month changes (or the dashboard saves something), and only asks for the day's trips when it shows them (the customer pages' booking form asks for its own). On the server a month's seats are two database reads however many days (`getDaysAvailability` in `utils/availability.js`), where trip by trip took about 150. A tap on a day is now one small request, so the limit of 60 a minute is far harder to reach. Tests: `bookings-public.test.js` (the answers, and the number of reads), `booking-form.spec.js`.
- **R-9 `[Owner]` Editing a booking on an extra trip could move it to 11am: DONE.** While the day's trips were loading, or if they couldn't be loaded, the time box fell back to the first trip. The booking's own trip is now always in the list (`bookingForm.jsx`). Test: `extra-trips.spec.js` (the trips request fails, the booking stays on its trip).
- **R-10 `[Owner]` A booking paid in full by voucher was never charged for people added later: DONE.** When the owner edits a booking with a voucher on it, what the voucher covers is worked out again (`reapplyVoucher` in `utils/vouchers.js`): people it covers are never charged (a voucher for 3 adults used by 2 covers the third when they join), people it doesn't cover are, and the booking goes back to its saved card (or unpaid) for the rest, or to "paid with a voucher" if people are taken off. The dashboard's message says what it now covers and what is left to pay. Not for a booking already paid or being charged. Test: `vouchers.test.js`.
- **R-11 `[Server]` Abandoned bookings left a customer record at Stripe: DONE.** The server no longer makes a Stripe customer before sending someone to Stripe's page. Stripe makes it when the card is saved (`customer_creation: 'always'`; checked that Stripe's test mode accepts this for saving a card), and the server then adds the name and phone. Tests: `checkout.test.js`. **Not proved by the tests: a real card saved and charged this way.** Needs one test booking against real Stripe (test mode) before go-live.
- **R-12 `[Customer]` Two things after a trip is moved: DONE.** The footer of a booking's emails names the harbour its trip leaves from, with that harbour's map (it always said Creux). And free cancellation after a move now follows the terms more closely (owner's choice, 9 Nov 2026): a trip remembers when its time was last changed (`timeMovedAt` on its row, for the usual trips and the extra ones, whose moves used to be forgotten), and **only customers who booked before the move** can cancel free until it leaves; someone who booked after it chose the new time and has the usual 24 hours. It used to be everyone on a moved usual trip and nobody on a moved extra trip. A new harbour or name alone doesn't count. Tests: `trips.test.js`, `email-layout.test.js`, `extra-trips.test.js`, `manage.test.js`.
- **R-13 `[Owner]` The login limit counted successful logins: DONE.** Only wrong guesses count now; five wrong guesses in 15 minutes still lock that visitor out. Test: `auth.test.js`.
- **R-14 `[Server]` A failed database connection at startup: DONE.** It used to log "Could not connect" without the reason and carry on for ever with no database and no timers. Now it logs the reason and tries again every 15 seconds (`DB_RETRY_SECONDS`) until it connects; the pages stay up meanwhile, and the charges and reminders start as soon as it does. (Trying again was chosen over stopping: Heroku can wait 20 minutes before restarting an app that keeps stopping.) Test: `startup.test.js` (the database comes up late).
- **R-15 `[Server]` Charters on the dashboard: DONE.** The server now refuses a dashboard charter on a trip that already has bookings, and an edit that would make a charter of more than 12. Test: `bookings-admin.test.js`.
- **R-16 `[Server]` Booking references: DONE.** A new booking's reference is checked against the others and drawn again if it is taken (`unusedReference` in `utils/bookingCodes.js`). Test: `models.test.js`.
- **R-17 `[Owner]` The report shows how much of the income isn't marked paid: DONE** (owner's choice, 9 Nov 2026: Income stays what the bookings are worth, so cash taken without pressing Mark paid still counts). A new figure, Not yet paid, with the number of bookings, on the Report tab, and a last column in the CSV: bookings with a card still to be charged, a card that failed, or money to collect. Tests: `prices-report.test.js`, `dashboard.spec.js`.

### Open

- **R-18 `[Build]` `npm audit` lists 10 advisories in the server's installed packages** (9 Nov 2026: express, mongoose, nodemailer, axios and packages they use; one marked critical in `proxy-addr`). Not looked into one by one. `npm audit fix` covers all but nodemailer, which needs a major version. Do it as its own change, with the full check. S–M.
- **R-19 `[Build]` Tidy-up.** (The dashboard form's time box issue is R-9, done.) Unused packages: `axios` in the root; `cors`, `uuid` and `react-router-dom` in the client. The server code isn't linted (how the unused imports got in). Repeated helpers: pence to pounds in six server files, the email pattern in three, the "download a file" helper in three client files, `escapeRegex`, `forStripe`, `isWhole`, `blank` and the code letters in two each. Leftovers: the old `/bookings/search/<text>` address (only tests use it), `express.static("public")` (no such folder), `express.urlencoded` (nothing posts a form), a `console.log` in `bookingForm.jsx`, "check console for errors" in `checkDate`, the dashboard form's customer wording ("Required fields", "Nothing has been charged"). The phone number is typed in `server/emails/layout.js` and `client/src/utils/contact.js`. The dashboard's code is in the one script every customer downloads: loading it only on `/dashboard` would make that script smaller.

---

## Suggested order of work

1. **Safety (P0 plus P1-6):** P0-1, P0-5, P1-6, then P0-2, P0-3, P0-4 as one Stripe pass.
2. **Correctness:** P1-3, P1-1, P1-2, P1-4, P1-5, with P1-8 (tests and CI) built alongside so each fix has a test.
3. **Foundations:** P1-10 (date format), P1-9, P1-7, P3-1, P3-2.
4. **Owner value that needs no bulk email:** P2-1 (done), P2-4 (done), then P2-3.
5. **Email foundation (done 30 Oct 2026, apart from the trip times):** P2-11 (one place for the sender address, contact details and trip times), then P2-10 (a proper email service and your own domain instead of the free Gmail address).
6. **Trip tools:** P2-2 (change a trip's time, close a trip, notify everyone on it). Only after step 5, because it sends many emails at once.
7. **Customer growth and SEO:** P2-9, P2-6, P2-7 (done), P2-8.

## Decisions needed from you

- ~~**Refund flow (P2-4)**~~ Decided: no refund flow. The card is charged at the trip time, and a weather cancellation is made in the dashboard before then, so nothing was charged (see `paymentsspec.md`).
- **How the automatic charge runs (P2-4):** a timer inside the app (recommended), Heroku Scheduler, or an outside pinger. See `paymentsspec.md`.
- **Stripe webhook (P0-2):** is it OK to configure one in the Stripe dashboard? (Needed at go-live; see `CLAUDE.md`.)
- ~~**Email provider (P2-10)**~~ Decided: Zoho Mail Lite, `info@sarkboattrips.com`, also used by the website to send.
- **Self-service cancellation (P2-6):** how close to the trip should customers be allowed to cancel themselves, if at all?
- ~~**Cutoff (P1-3)**~~ Decided: customers can book until 1 hour before the trip; charters follow the same rule.
- ~~**Prices in the dashboard**~~ Decided and built (P2-1): adult, child and charter prices, locked until Edit is pressed.
- **Other settings in the dashboard (P2-11):** which would you also like to change yourself (capacity, timeslots)?
