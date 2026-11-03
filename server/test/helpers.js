// Shared set-up for the server tests. Every test file gets its own settings, a fake mailer, a fake
// Stripe and its own throwaway in-memory MongoDB, so nothing here can touch real data, real
// email or real keys. Usage in a test file, in this order:
//
//   const t = require('./helpers');
//   t.setEnv({ ...optional overrides });   // before anything from ../ is loaded
//   const mocks = t.installMocks();
//   const app = require('../app');
//   before(() => t.startDb());  after(() => t.stopDb());
const Module = require('module');
let currentMocks; // the fakes installed by installMocks, for the helpers below
const assert = require('node:assert/strict');

const OWNER = 'owner@sarkboattrips.test'; // OWNER_EMAIL: where the owner's alerts go
const MAIL_FROM = 'hello@sarkboattrips.test'; // every email comes from this address
const PASSWORD = 'correct horse battery staple';
const USERNAME = 'owner';
const WEBHOOK_SECRET = 'whsec_test_secret';

const setEnv = (overrides = {}) => {
    const bcrypt = require('bcryptjs');
    Object.assign(process.env, {
        NODE_ENV: 'test', // anything but "production"
        JWT_SECRET: 'test-jwt-secret-test-jwt-secret-test-jwt-secret',
        admin_username: USERNAME,
        admin_password_hash: bcrypt.hashSync(PASSWORD, 4),
        STRIPEKEY: 'sk_live_FAKE',
        STRIPETESTKEY: 'sk_test_FAKE',
        PUBLIC_URL: 'http://localhost:5173',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        MAIL_FROM,
        OWNER_EMAIL: OWNER,
        SMTP_HOST: 'smtp.example.test',
        SMTP_PASSWORD: 'unused',
        // the old Gmail settings are still in many .env files: set, to prove they are ignored
        gmail_address: 'nobody@example.test',
        gmail_password: 'unused',
    });
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
};

// Replaces email sending and the Stripe library with fakes. The real Stripe library is kept for
// checking webhook signatures; only the calls that would reach Stripe's servers are faked.
const installMocks = () => {
    const mocks = {
        mails: [], // every email attempted: { from, to, subject, html, text, attachments, result }
        transport: null, // the mail server settings the mailer was given
        mailMode: 'none', // 'none' | 'client' | 'admin' | 'all': which emails should fail
        failTo: new Set(), // and emails to these addresses fail too
        // keys given to Stripe, checkout sessions requested, customers created, fake sessions and
        // saved cards (setup intents) it knows, and whether creating a session should fail
        stripe: {
            keys: [], created: [], customers: [], sessions: {}, setupIntents: {}, fail: false,
            deleted: [], // customers removed (erasing a customer's data); fail makes that fail too
            // card charges: every request made, the answers given per idempotency key, and how a
            // saved card behaves: 'ok' (default), 'declined', 'insufficient_funds',
            // 'authentication_required', 'unreachable' (Stripe can't be reached) or 'processing'
            charges: [], intents: {}, cards: {},
        },
    };
    currentMocks = mocks;
    mocks.sent = (to) => mocks.mails.filter((m) => m.result === 'sent' && (!to || m.to === to));
    mocks.reset = () => {
        mocks.mails.length = 0; mocks.mailMode = 'none'; mocks.failTo.clear(); mocks.stripe.created.length = 0; mocks.stripe.customers.length = 0; mocks.stripe.charges.length = 0; mocks.stripe.deleted.length = 0; mocks.stripe.fail = false;
        for (const store of [mocks.stripe.sessions, mocks.stripe.setupIntents, mocks.stripe.intents, mocks.stripe.cards]) for (const key of Object.keys(store)) delete store[key];
    };

    require('nodemailer').createTransport = (transport) => {
        mocks.transport = transport;
        return {
            sendMail: async (options) => {
                const toOwner = options.to === OWNER;
                const fail = mocks.mailMode === 'all' || (mocks.mailMode === 'client' && !toOwner) || (mocks.mailMode === 'admin' && toOwner) || mocks.failTo.has(options.to);
                mocks.mails.push({ from: options.from, to: options.to, replyTo: options.replyTo, subject: options.subject, html: options.html || '', text: options.text || '', attachments: options.attachments || [], result: fail ? 'failed' : 'sent' });
                if (fail) throw new Error('fake mail failure');
                return { messageId: 'fake' };
            },
        };
    };

    const load = Module._load;
    Module._load = function (request) {
        const loaded = load.apply(this, arguments);
        if (request !== 'stripe' || loaded.__fake) return loaded;
        const fake = function (key, ...rest) {
            mocks.stripe.keys.push(String(key));
            const client = loaded(key, ...rest);
            client.checkout.sessions.create = async (params) => {
                if (mocks.stripe.fail) throw new Error('fake Stripe outage');
                mocks.stripe.created.push(params);
                return { id: `cs_test_created_${mocks.stripe.created.length}`, url: `https://checkout.stripe.test/c/pay/cs_test_created_${mocks.stripe.created.length}` };
            };
            client.customers.create = async (params) => {
                mocks.stripe.customers.push(params);
                return { id: `cus_test_${mocks.stripe.customers.length}` };
            };
            client.customers.del = async (id) => {
                if (mocks.stripe.fail) throw Object.assign(new Error('fake Stripe unreachable'), { type: 'StripeConnectionError' });
                mocks.stripe.deleted.push(id);
                return { id, object: 'customer', deleted: true };
            };
            // A saved card. Unless a test set one up, every setup intent holds a Visa ending 4242
            client.setupIntents.retrieve = async (id) => mocks.stripe.setupIntents[id] || {
                id, payment_method: { id: `pm_for_${id}`, card: { brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2030 } },
            };
            client.paymentIntents.create = async (params, options = {}) => {
                mocks.stripe.charges.push({ params, options });
                const key = options.idempotencyKey;
                if (key && mocks.stripe.intents[key]) return mocks.stripe.intents[key]; // the same answer again, like Stripe
                const behaviour = mocks.stripe.cards[params.payment_method] || 'ok';
                if (behaviour === 'unreachable') throw Object.assign(new Error('fake Stripe unreachable'), { type: 'StripeConnectionError' });
                const id = `pi_test_${mocks.stripe.charges.length}`;
                if (['declined', 'insufficient_funds', 'authentication_required'].includes(behaviour)) {
                    const error = Object.assign(new Error('Your card was declined.'), {
                        type: 'StripeCardError',
                        code: behaviour === 'authentication_required' ? 'authentication_required' : 'card_declined',
                        decline_code: behaviour === 'insufficient_funds' ? 'insufficient_funds' : behaviour === 'authentication_required' ? 'authentication_required' : 'generic_decline',
                        payment_intent: { id, status: 'requires_payment_method' },
                    });
                    throw error;
                }
                const intent = { id, object: 'payment_intent', amount: params.amount, status: behaviour === 'processing' ? 'processing' : 'succeeded' };
                if (key) mocks.stripe.intents[key] = intent;
                return intent;
            };
            client.paymentIntents.retrieve = async (id) => {
                const intent = Object.values(mocks.stripe.intents).find((i) => i.id === id);
                if (!intent) throw Object.assign(new Error(`No such payment_intent: ${id}`), { type: 'StripeInvalidRequestError' });
                return intent;
            };
            client.checkout.sessions.retrieve = async (id) => {
                const session = mocks.stripe.sessions[id];
                if (!session) throw Object.assign(new Error(`No such checkout.session: ${id}`), { type: 'StripeInvalidRequestError' });
                return session;
            };
            return client;
        };
        fake.__fake = true;
        return fake;
    };
    return mocks;
};

let mongod;
const startDb = async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoose = require('mongoose');
    // Test files run side by side and each starts its own database, and two of them can pick the
    // same port at the same instant. If that happens, wait a moment and try again.
    for (let attempt = 1; ; attempt++) {
        try { mongod = await MongoMemoryServer.create(); break; }
        catch (error) {
            if (attempt >= 8) throw error;
            await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 1000));
        }
    }
    await mongoose.connect(mongod.getUri());
    // build the unique index on the Stripe session id, which the idempotency tests rely on
    await require('../models/bookings').init();
    await seedSeason();
    return mongoose.connection.db;
};
const dbUri = () => mongod.getUri();
const stopDb = async () => {
    await require('mongoose').disconnect();
    if (mongod) await mongod.stop();
};
const resetDb = async () => {
    const db = require('mongoose').connection.db;
    for (const name of ['bookings', 'availabilities', 'notes', 'vouchers']) await db.collection(name).deleteMany({});
};

// Dates. The booking site only accepts dates that are in the future and inside the season, so the
// tests work relative to today: day(10) is ten days from now, as a YYYY-MM-DD booking date.
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
// the same date the way emails and messages write it for people (dd-mm-yyyy)
const shown = (isoDay) => require('../utils/dates').showDay(isoDay);
// how emails write a date: 'Monday 9 November 2026', and 'Mon 9 Nov' in subjects
const long = (isoDay) => require('../utils/dates').longDay(isoDay);
const short = (isoDay) => require('../utils/dates').shortDay(isoDay);
const seedSeason = async () => {
    const midnight = (offset) => { const d = new Date(Date.now() + offset * 86400000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
    await require('../models/admin').deleteMany({});
    // the normal prices: adult £40, child £25, charter £400 (in pence)
    await require('../models/admin').create({ seasonStartDate: midnight(-30), seasonEndDate: midnight(200), adultPrice: 4000, childPrice: 2500, charterPrice: 40000 });
};

// HTTP helpers. Each call can pose as a different visitor (the app trusts one proxy, so the
// X-Forwarded-For header decides who the rate limits think is calling).
let visitor = 0;
const nextIp = () => `10.${Math.floor(++visitor / 60000)}.${Math.floor(visitor / 250) % 250}.${(visitor % 250) + 1}`;
const call = (app, method, path, { body, token, ip, headers } = {}) => {
    let req = require('supertest')(app)[method](path).set('X-Forwarded-For', ip || nextIp());
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    if (headers) req = req.set(headers);
    return body === undefined ? req : req.send(body);
};
const login = async (app) => {
    const res = await call(app, 'post', '/admin/login', { body: { userName: USERNAME, password: PASSWORD } });
    assert.equal(res.status, 200, 'the test login should work');
    return res.body.token;
};

// A valid customer booking, with any field overridden
let seq = 0;
const booking = (overrides = {}) => ({
    date: day(10), timeslot: '11am', firstName: 'Alice', lastName: 'Smith', email: `alice${++seq}@example.test`,
    phone: '07123 456789', adults: '2', children: '0', accommodation: 'Hotel Dixcart', message: 'Looking forward to it!',
    ...overrides,
});

// Inserts a booking straight into the database (skipping the app's rules), returns its id
const insertBooking = async (fields = {}) => {
    const result = await require('mongoose').connection.db.collection('bookings').insertOne({
        date: day(10), timeslot: '11am', firstName: 'Test', lastName: 'Booking', adults: 2, children: 0,
        phone: '1', email: '', status: 'active', charter: 'false', ...fields,
    });
    return result.insertedId.toString();
};
const findBooking = (id) => require('mongoose').connection.db.collection('bookings').findOne({ _id: new (require('mongoose').Types.ObjectId)(id) });
const seatsLeft = async (app, date) => (await call(app, 'post', '/bookings/monthAvailability', { body: { dates: [date] } })).body.data[0];

// Signs and sends a Stripe webhook event the way Stripe would
const webhook = (app, session, { type = 'checkout.session.completed', secret = WEBHOOK_SECRET, signature } = {}) => {
    const Stripe = require('stripe');
    const payload = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: 'event', type, data: { object: session } });
    const header = signature ?? Stripe('sk_test_signing_only').webhooks.generateTestHeaderString({ payload, secret });
    return require('supertest')(app).post('/charters/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', header).set('X-Forwarded-For', nextIp()).send(payload);
};
// A finished Stripe checkout in which the customer saved a card (kind 'charter' unless overridden)
const cardSession = (id, overrides = {}) => ({
    id, object: 'checkout.session', mode: 'setup', status: 'complete', customer: 'cus_test_saved', setup_intent: `seti_${id}`,
    metadata: { kind: 'charter', timeslot: '11am', firstName: 'Carol', lastName: 'Charter', email: `carol${++seq}@example.test`, phone: '1', adults: '2', children: '0', date: day(12), accommodation: '', message: '', message2: '', ...overrides },
});

// Books online the way a customer does: starts the checkout (a trip, or kind 'charter'), and if
// that worked, saves the card on the fake Stripe page and delivers Stripe's webhook. Returns the
// first reply (res), the Stripe session and the booking made from it (or null).
const bookOnline = async (app, body, { kind = 'trip', ip } = {}) => {
    const path = kind === 'charter' ? '/charters/create-checkout-session' : '/bookings/checkout';
    const res = await call(app, 'post', path, { body, ip });
    if (!res.body.url) return { res, session: null, booking: null };
    const params = currentMocks.stripe.created.at(-1);
    const id = res.body.url.split('/').pop();
    const session = { id, object: 'checkout.session', mode: 'setup', status: 'complete', customer: params.customer, setup_intent: `seti_${id}`, metadata: params.metadata };
    currentMocks.stripe.sessions[id] = session;
    const delivered = await webhook(app, session);
    assert.equal(delivered.status, 200, 'the webhook should be accepted');
    const booking = await require('mongoose').connection.db.collection('bookings').findOne({ stripeSessionId: id });
    return { res, session, booking };
};

// Buys a gift voucher the way a customer does: starts the checkout, pays on the fake Stripe page and
// delivers Stripe's webhook. Returns the first reply (res), the Stripe session and the voucher (or null).
const buyVoucher = async (app, body, { ip } = {}) => {
    const res = await call(app, 'post', '/vouchers/checkout', { body, ip });
    if (!res.body.url) return { res, session: null, voucher: null };
    const params = currentMocks.stripe.created.at(-1);
    const id = res.body.url.split('/').pop();
    const session = {
        id, object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid',
        amount_total: params.line_items[0].price_data.unit_amount, payment_intent: `pi_${id}`, metadata: params.metadata,
    };
    currentMocks.stripe.sessions[id] = session;
    const delivered = await webhook(app, session);
    assert.equal(delivered.status, 200, 'the webhook should be accepted');
    const voucher = await require('mongoose').connection.db.collection('vouchers').findOne({ stripeSessionId: id });
    return { res, session, voucher };
};
// A voucher order from the Gift vouchers page, with any field overridden
const voucherOrder = (overrides = {}) => ({
    kind: 'trip', adults: '2', children: '0', recipientName: 'Jane', message: 'Happy birthday!',
    buyerName: 'Tom Le Page', buyerEmail: `tom${++seq}@example.test`, sendTo: 'buyer', ...overrides,
});

// Sends the emails a dashboard cancel holds back for a minute (utils/cancelEmails.js), as the timer would
const sendCancelEmails = () => require('../utils/cancelEmails').runDueCancelEmails(new Date(Date.now() + 2 * 60 * 1000));

module.exports = { sendCancelEmails, buyVoucher, voucherOrder, dbUri, OWNER, MAIL_FROM, PASSWORD, USERNAME, WEBHOOK_SECRET, setEnv, installMocks, startDb, stopDb, resetDb, seedSeason, day, shown, long, short, call, login, booking, insertBooking, findBooking, seatsLeft, webhook, cardSession, bookOnline };
