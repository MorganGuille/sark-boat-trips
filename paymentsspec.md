# Card on file, charged at trip time (payments spec)

**Status: being built on the `payments` branch.** Steps 1 (payment status and Mark paid) and 2 (saving cards) are done; step 3 (the charge timer) is next, then the wording and `/terms` page. Written up on 26 Oct 2026 from the owner's answers. The original spec written by Gemini is kept at the bottom for reference. Where the two disagree, **this section wins**.

## Why

No-shows are rising, and paying in advance is now what customers expect. The owner does not mind handling cash or card readers, but does not want to chase refunds when a trip is cancelled for weather, and is one person, so it has to be quick to run.

## The idea in one line

Every customer who books online saves a card (nothing is charged). The card is charged automatically **at the trip's start time (11am or 2pm)**. If the owner cancels the booking first, because of weather or anything else, **nothing was ever charged, so there is nothing to refund.**

## Decisions

| Question | Decision |
|---|---|
| Who saves a card? | **Everyone who books online**, normal trips and charters. |
| Dashboard bookings (the owner adds them) | No card. They start as **Unpaid** and the owner marks them **Paid** by hand (cash or card reader, as now). |
| Charters | The **£80 deposit goes away**. The card is saved for the full charter price and charged at the trip time, like any trip. (Risk accepted: a charter now takes no money up front.) |
| When is it charged? | Automatically at the trip's start time, in Guernsey time. No "Charge" button. |
| How much? | Adults × adult price + children × child price (infants free), or the flat charter price. Prices come from the dashboard price settings (see below). The amount is worked out **at charge time** from the booking, so edits to the party size before the trip count. |
| Weather cancellation | The owner cancels the booking (or, later, the whole trip) in the dashboard before the trip time. Cancelled bookings are never charged. No refund flow is needed. |
| If the charge fails (decline, or the bank wants an extra check) | The booking is marked **Unpaid** and the owner collects after the trip by card or cash, then marks it **Paid**. The customer is not chased automatically. |
| If a customer doesn't finish entering a card | **No card, no booking.** Same as charters today: the booking is only created once Stripe says the card is saved. The customer can try again or contact the owner. No seats are held in the meantime. |
| Card entry | **Stripe's hosted page in "save a card" mode**, the same kind of page charters use now. No card fields on our site, so no new security-policy changes and no card handling by us. (This replaces the spec's own Elements form. It still uses a SetupIntent underneath, which was the spec's strict requirement.) |
| Fees | About the same as the owner already pays on SumUp (roughly 80% of payments are by card). Disputes are not expected to be a problem. |

## Bookings made weeks or months ahead (decided 30 Oct 2026)

A card saved this way has **no time limit** on Stripe: it stays on the customer's record until the card expires or we remove it, so a January booking for an August trip is charged in August. (The 7 to 30 day limits people quote are for *authorisation holds*, where money is reserved at booking. We deliberately don't do that.)

The longer the gap, the more can go wrong on the day: the card expired or was replaced (Stripe updates many reissued cards automatically, not all), was cancelled, has no funds, or the bank asks the customer to confirm. **Decision: option 1, treat every booking the same.** A failed charge marks the booking Unpaid and the owner collects after the trip. **Each failed charge records why**, so after a season the owner can see how often early bookings fail. If it turns out to matter, add later: a hold for the full amount two days before the trip, taken at the trip time, with an email asking for a new card if the hold fails (released, not refunded, if the trip is cancelled). Nothing built now would need undoing for that.

## What the owner sees on each booking

A payment status: **Card saved**, **Paid** (charged online), **Paid in person** (cash or card reader, marked by hand), **Unpaid** (no card, or the charge failed). A dashboard booking is Unpaid until marked. A failed charge also shows why, in plain words.

## Prices (built first: see the price settings)

Adult, child and charter prices are settings the owner changes in the dashboard (top row, next to the season dates). Infants are free. **Each booking saves the prices in force when it was made**, so changing next year's prices never changes an old booking or last year's income. Both the monthly CSV and this payment feature work out money from those saved prices. Once payments are built, the Stripe `PRICE_ID` setting is no longer needed (the amount is sent to Stripe directly) and should be removed.

## Wording customers must see before saving a card

Plain words next to the card step (and in the confirmation email): the card is **not charged now**; it is charged **£X at the trip's start time** on the day; **trips cancelled for weather are never charged**; how to cancel (until a manager link exists in P2-6: phone or email before the trip time). The owner to approve the exact text.

## How the automatic charge runs (recommended A; owner to confirm)

Stripe cannot schedule a charge for us, so something has to check the bookings and start the charge at 11:00 and 14:00. The check looks for bookings whose trip start has passed, that have a saved card, are not cancelled and not already paid, and charges each one. It must be **safe to run twice** (a booking can never be charged twice: Stripe's idempotency key per booking) and must **catch up** if the server was busy or restarting at the exact minute.

| Option | How it works | Good | Not so good |
|---|---|---|---|
| **A. A timer inside the app** (recommended) | The server checks every minute. | Nothing else to pay for or set up. Works on any host that stays switched on. Heroku's $7 Basic dyno does stay on (the free tier would sleep). | It doesn't run if the server is down at that moment, but the next check catches up. Heroku restarts each app daily, so the catch-up matters. |
| **B. Heroku Scheduler** (free add-on) | Heroku starts a one-off job every 10 minutes. | Runs even if the web server is restarting. | Heroku only. Up to 10 minutes late. Gets lost if you move host. |
| **C. An outside pinger** (a free cron service calls a secret address every few minutes) | The service calls the app, which does the check. | Works on any host, even one that sleeps. | One more service and a secret to look after. |
| **D. n8n, as in the original spec** | A separate workflow tool calls the app. | Flexible. | A whole extra thing to run and keep safe, for one job. Not needed. |

Recommendation: **A**, with the check also reachable through a protected address so **C** can be added if the host ever changes. Moving host is fine for this design as long as the new host keeps the app switched on.

## Technical notes for the charge timer

(Gemini's three notes, which match the plan above, written precisely, with the gaps filled in.)

1. **Catch up, never match exact times.** Each check charges every booking whose trip has *already started* (start time at or before now, in Guernsey time), whose status is `card_saved` and which is not cancelled. A restart or delay at 11:00 is caught on the next check. Bookings store a day (`YYYY-MM-DD`) and a timeslot, not a start time, so the check finds candidates with `date <= today` and works out the exact start (11:00 or 14:00 Guernsey time, including the clock changes) in code, using the same helpers as the booking cutoff in `utils/validateBooking.js`. **The start time comes from one function, `tripStartsAt(date, timeslot)`, never from the timeslot name directly.** Today it maps `11am` to 11:00 and `2pm` to 14:00. When the owner can change a trip's time for one day (spec P2-2, free choice of time), that function checks for a change first, so the charge moves with the trip and nothing in the timer changes. The one-hour booking cutoff should use the same function (today it reads the fixed hours in `validateBooking.js`).
2. **Claim before charging.** Before calling Stripe, the booking is switched from `card_saved` to `charging` in one database step that only succeeds if it was still `card_saved`. Two overlapping checks (or two copies of the app) can then never both charge it. Afterwards it becomes `paid` or `unpaid` with the reason. A booking left in `charging` by a crash is retried by the next check, which is safe because of point 3.
3. **One idempotency key per booking: `charge_booking_<booking id>`.** If a request times out or is sent twice, Stripe returns the first result instead of charging again. Two things to keep in mind: Stripe keeps a key for 24 hours, and it rejects the same key sent with a *different amount*. That's fine here because each booking is charged at most once (a failure becomes Unpaid and is never retried automatically). If automatic retries are ever added, the key must include the attempt number.
4. **Charge as an off-session payment.** The charge is created with the saved customer and card, `off_session: true` and `confirm: true`, so Stripe treats it as a merchant-initiated charge under the UK's strong-authentication rules (the customer agreed when saving the card). If the bank still asks the customer to confirm, Stripe returns an error (`authentication_required`), and the booking becomes Unpaid with a plain-words reason, like a decline.
5. **Amount, currency, description.** The amount is worked out at that moment in pence (`bookingValue` in `utils/prices.js`), the currency is `gbp`, and the description names the trip ("Sark Boat Trips 11am 14-06-2027"), so the customer's receipt makes sense. A booking worth £0 (for example only infants) is marked paid without calling Stripe.

## Other things to settle or build around it

- **Customers cancelling themselves** (P2-6) matters more now: until then, a customer who cancels has to phone or email before the trip time, or they will be charged.
- **Pause for the day:** a trip-wide "cancel everything for this trip" (P2-2) would make a weather call one tap instead of one per booking. Worth building before the first season of automatic charges.
- **Failed-charge alert:** the owner gets an email listing bookings that failed, and the dashboard shows them as Unpaid. The email depends on the Gmail replacement (P2-10) being reliable.
- **Erasing a customer's data** (P2-13) must also delete their Stripe customer and saved card.
- **The webhook** (`/charters/webhook`) gets new events: the card-saved event creates the booking, and payment results update its status. Needs the same signing secret as now.
- **Test before the season:** Stripe has test cards that are declined or demand a bank check, so the failure paths can be tried in test mode. A real charge cannot be rehearsed automatically.
- **Order of work:** price settings and the CSV report first (they give the amounts), then this, then the customer cancel link and the trip-wide cancel.

## Setting it up, step by step

### What the owner does in Stripe (test mode first, then the same in live mode at go-live)

1. **Public details** (Settings → Business → Public details): business name, support phone and email, and a **statement descriptor** such as `SARK BOAT TRIPS`. That is what appears on the customer's bank statement on the day of the trip, so they recognise the charge (the main defence against disputes).
2. **Terms of service address**, in the same place: the address of the site's terms page (we add a real `/terms` page; today the terms only open as a pop-up in the footer). Stripe's page then shows "I agree to the terms" before the card is saved.
3. **Branding** (Settings → Branding): logo and colours, so Stripe's page looks like the business. Optional, but it helps trust.
4. **Receipts** (Settings → Customer emails): switch on "Successful payments", so each customer gets a receipt from Stripe when they are charged on the day.
5. **Payment methods** (Settings → Payment methods): cards on (they are by default). Apple Pay and Google Pay can stay on: they work for saving a card.
6. **Webhook**: no new events needed. Setup-mode checkouts send the same `checkout.session.completed` event the charters already use. The webhook itself is set up at go-live (see the go-live checklist in `CLAUDE.md`). On a laptop, the Stripe CLI (`stripe listen --forward-to localhost:4040/charters/webhook`) forwards test events.
7. **Nothing else:** the `PRICE_ID` price object is no longer used (amounts come from the dashboard prices) and the £80 deposit disappears. Saving a card costs nothing; Stripe's fee is taken only when a charge succeeds.

### What gets built (in the sandbox, with the Stripe test key)

1. **Booking fields:** payment status, Stripe customer and saved card, amount paid, when, and the plain-words reason for a failed charge. **Done (step 1)**, with the dashboard's Payment column (status and amount owed, worked out by the server from the saved prices), **Mark paid** (cash or card reader; also stops a saved card being charged) and **Undo paid** (goes back to Card saved if there is a card). Routes `POST /bookings/mark-paid` and `/mark-unpaid`, owner only. A customer can't send any payment field, and editing a booking can't change them.
2. **Booking flow:** the public booking form and the charter form both go to Stripe's hosted page in "save a card" mode. The booking is created only when Stripe confirms the card is saved (by the webhook or the success page, through one shared function, as charters work today), and only then are the emails sent. The success page covers both. **Done (step 2):** `controllers/checkout.js`; `POST /bookings/checkout` for trips (the old instant `/bookings/add` is gone) and the existing charter route; a Stripe customer per booking; Stripe's page shows "Your card won't be charged now. £X will be charged at 11am on dd-mm-yyyy, when your trip starts. If we cancel because of the weather, you won't be charged."; bookings start as Card saved, with the card shown on the dashboard ("Visa •••• 4242 (expires 08/28)"); confirmation emails say what will be charged. **If the trip fills up while the customer is on Stripe's page, nothing is overbooked:** the booking is kept as cancelled with the reason, the customer is told nothing was charged, and the owner can restore it if room frees up. Online booking is refused until the dashboard prices are set. The deposit checkout and `PRICE_ID` are removed (item 6 done).
3. **The charge timer:** a check every minute inside the app. Bookings whose trip has started, with a saved card, not cancelled and not yet paid, are charged once (Stripe idempotency key per booking), and the amount is worked out at that moment from the saved prices and the current party size. The result is recorded on the booking; failures go to the owner in one email.
4. **Dashboard:** a payment status on every booking (Card saved, Paid, Paid in person, Unpaid with the reason), and a "Mark paid in person" button for dashboard bookings and failed charges.
5. **Wording:** the booking and charter pages, the confirmation emails and a new `/terms` page say clearly when the card is charged, that weather cancellations are never charged, and how to cancel. The charter page's "refundable deposit of 20%" text goes. **The owner approves the final wording.**
6. **Tidy-up:** remove the deposit checkout and the `PRICE_ID` setting.
7. **Tests:** server tests with a fake Stripe (saved, charged, declined, bank asks to confirm, charged only once, cancelled never charged), browser tests for the new flow, and the checks that each test can fail.
8. **A real rehearsal in Stripe test mode** (fake money): save a card on Stripe's real page, move the booking's date into the past on the dashboard so the timer charges it, and confirm it in the Stripe dashboard. Stripe's test cards cover the failures: `4242 4242 4242 4242` (works), `4000 0000 0000 0341` (saves, but every later charge is declined), `4000 0000 0000 9995` (declined, no funds), `4000 0027 6000 3184` (the bank always asks the customer to confirm).

### At go-live (added to the checklist in `CLAUDE.md` when this is built)

Repeat the owner's Stripe steps in live mode, deploy, and make sure the Heroku plan is one that stays switched on (the $7 Basic plan does), because the timer runs inside the app.

## Data to store on each booking

`stripeCustomerId`, `stripePaymentMethodId`, `paymentStatus` (`unpaid`, `card_saved`, `paid`, `paid_in_person`), `paidAt`, `amountPaid` (pence), `paymentNote` (the plain-words reason a charge failed), and the saved prices (`prices.adult`, `prices.child`, `prices.charter`, in pence).

---

# Original spec (written by Gemini): kept for reference

Context & Goal:
We are building a custom booking system for a boat tour company. To handle payments, we are implementing a "Reserve Now, Pay Later" architecture using Stripe. We want to vault the customer's card securely at the time of booking without charging it, and then execute an automated off-session charge on the day of the tour.

Tech Stack:

Frontend: React

Backend/API: Node.js / Express

Database: MongoDB

Automation/Triggers: ?

Payment Gateway: Stripe API (SetupIntents & PaymentIntents)

Please write the frontend components and backend API routes to satisfy the following specification:

1. Database Schema Requirements
The Booking model needs to store the following Stripe-related fields:

stripeCustomerId (String) - Maps to the Stripe Customer object.

stripePaymentMethodId (String) - The ID of the vaulted card (starts with pm_...).

paymentStatus (Enum: pending, vaulted, succeeded, requires_action, failed) - Tracks the lifecycle.

2. Phase 1: Checkout & Vaulting (At Booking)
Strict Requirement: Do NOT use the legacy Charges API or PaymentIntents at checkout. We must use SetupIntents.

Backend API (/api/checkout/setup):

Create or retrieve a Stripe Customer.

Create a SetupIntent attached to that customer. Set usage: 'off_session'.

Return the client_secret to the React frontend.

React Frontend:

Initialize Stripe Elements using the client_secret.

Render the PaymentElement (this automatically handles Apple Pay/Google Pay logic based on card compatibility for off-session usage).

Call stripe.confirmSetup().

Webhook / Success Handler (/api/webhooks/stripe):

Listen for setup_intent.succeeded.

Extract the payment_method ID from the payload.

Update the Booking record in the database: set stripePaymentMethodId and update status to vaulted.

3. Phase 2: The Delayed Charge (Off-Session)
This phase is triggered by our backend scheduler or n8n workflow exactly on the morning of the tour.

Backend API (/api/payments/charge-booking):

Fetch the Booking record to get the stripeCustomerId and stripePaymentMethodId.

Create a PaymentIntent with the following strict parameters:

amount: [Total Booking Amount]

currency: 'gbp'

customer: stripeCustomerId

payment_method: stripePaymentMethodId

confirm: true (Attempts to charge immediately)

off_session: true (Crucial for bypassing standard SCA flows)

4. Phase 3: Error Handling & SCA Fallback
Because the charge is off_session, we must handle potential 3D Secure (SCA) demands from the customer's bank.

Handling requires_action:

If the PaymentIntent creation returns a status of requires_action or requires_payment_method, update the database status to requires_action.

Output a response that triggers our notification system (e.g., sending an email/WhatsApp via n8n with a Stripe hosted link for the customer to authenticate the charge).

Handling Declines:

If the card simply declines, log the error, update the status to failed, and output a payload so we can notify the customer to update their payment method.

Note to Claude: Please structure the backend logic cleanly with standard try/catch blocks and Stripe error handling. Write the React checkout component using @stripe/react-stripe-js.

When you hand this to Claude, it will know exactly which endpoints to scaffold, how to configure the React components, and most importantly, it won't accidentally write a standard immediate-charge checkout flow.
