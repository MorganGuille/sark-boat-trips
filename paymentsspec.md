# Card on file, charged at trip time (payments spec)

**Status: decided, not built yet.** Written up on 26 Oct 2026 from the owner's answers. The original spec written by Gemini is kept at the bottom for reference. Where the two disagree, **this section wins**.

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

## What the owner sees on each booking

A payment status: **Card saved**, **Paid** (charged online), **Paid in person** (cash or card reader, marked by hand), **Unpaid** (no card, or the charge failed). A dashboard booking is Unpaid until marked. A failed charge also shows why, in plain words.

## Prices (built first: see the price settings)

Adult, child and charter prices are settings the owner changes in the dashboard (top row, next to the season dates). Infants are free. **Each booking saves the prices in force when it was made**, so changing next year's prices never changes an old booking or last year's income. Both the monthly CSV and this payment feature work out money from those saved prices. Once payments are built, the Stripe `PRICE_ID` setting is no longer needed (the amount is sent to Stripe directly) and should be removed.

## Wording customers must see before saving a card

Plain words next to the card step (and in the confirmation email): the card is **not charged now**; it is charged **£X at the trip's start time** on the day; **trips cancelled for weather are never charged**; how to cancel (until a manager link exists in P2-6: phone or email before the trip time). The owner to approve the exact text.

## How the automatic charge runs (open: owner to choose)

Stripe cannot schedule a charge for us, so something has to check the bookings and start the charge at 11:00 and 14:00. The check looks for bookings whose trip start has passed, that have a saved card, are not cancelled and not already paid, and charges each one. It must be **safe to run twice** (a booking can never be charged twice: Stripe's idempotency key per booking) and must **catch up** if the server was busy or restarting at the exact minute.

| Option | How it works | Good | Not so good |
|---|---|---|---|
| **A. A timer inside the app** (recommended) | The server checks every minute. | Nothing else to pay for or set up. Works on any host that stays switched on. Heroku's $7 Basic dyno does stay on (the free tier would sleep). | It doesn't run if the server is down at that moment, but the next check catches up. Heroku restarts each app daily, so the catch-up matters. |
| **B. Heroku Scheduler** (free add-on) | Heroku starts a one-off job every 10 minutes. | Runs even if the web server is restarting. | Heroku only. Up to 10 minutes late. Gets lost if you move host. |
| **C. An outside pinger** (a free cron service calls a secret address every few minutes) | The service calls the app, which does the check. | Works on any host, even one that sleeps. | One more service and a secret to look after. |
| **D. n8n, as in the original spec** | A separate workflow tool calls the app. | Flexible. | A whole extra thing to run and keep safe, for one job. Not needed. |

Recommendation: **A**, with the check also reachable through a protected address so **C** can be added if the host ever changes. Moving host is fine for this design as long as the new host keeps the app switched on.

## Other things to settle or build around it

- **Customers cancelling themselves** (P2-6) matters more now: until then, a customer who cancels has to phone or email before the trip time, or they will be charged.
- **Pause for the day:** a trip-wide "cancel everything for this trip" (P2-2) would make a weather call one tap instead of one per booking. Worth building before the first season of automatic charges.
- **Failed-charge alert:** the owner gets an email listing bookings that failed, and the dashboard shows them as Unpaid. The email depends on the Gmail replacement (P2-10) being reliable.
- **Erasing a customer's data** (P2-13) must also delete their Stripe customer and saved card.
- **The webhook** (`/charters/webhook`) gets new events: the card-saved event creates the booking, and payment results update its status. Needs the same signing secret as now.
- **Test before the season:** Stripe has test cards that are declined or demand a bank check, so the failure paths can be tried in test mode. A real charge cannot be rehearsed automatically.
- **Order of work:** price settings and the CSV report first (they give the amounts), then this, then the customer cancel link and the trip-wide cancel.

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
