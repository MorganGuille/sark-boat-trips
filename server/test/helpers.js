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
const assert = require('node:assert/strict');

const OWNER = 'sarkboattrips@gmail.com';
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
        PRICE_ID: 'price_test_FAKE',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
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
        mails: [], // every email attempted: { to, subject, html, text, result }
        mailMode: 'none', // 'none' | 'client' | 'admin' | 'all': which emails should fail
        stripe: { keys: [], created: [], sessions: {}, fail: false }, // keys given to Stripe, checkout sessions requested, fake sessions it knows, and whether creating one should fail
    };
    mocks.sent = (to) => mocks.mails.filter((m) => m.result === 'sent' && (!to || m.to === to));
    mocks.reset = () => { mocks.mails.length = 0; mocks.mailMode = 'none'; mocks.stripe.created.length = 0; mocks.stripe.fail = false; };

    require('nodemailer').createTransport = () => ({
        sendMail: async (options) => {
            const toOwner = options.to === OWNER;
            const fail = mocks.mailMode === 'all' || (mocks.mailMode === 'client' && !toOwner) || (mocks.mailMode === 'admin' && toOwner);
            mocks.mails.push({ to: options.to, subject: options.subject, html: options.html || '', text: options.text || '', result: fail ? 'failed' : 'sent' });
            if (fail) throw new Error('fake mail failure');
            return { messageId: 'fake' };
        },
    });

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
    for (const name of ['bookings', 'availabilities', 'notes']) await db.collection(name).deleteMany({});
};

// Dates. The booking site only accepts dates that are in the future and inside the season, so the
// tests work relative to today: day(10) is ten days from now, as a YYYY-MM-DD booking date.
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
// the same date the way emails and messages write it for people (dd-mm-yyyy)
const shown = (isoDay) => require('../utils/dates').showDay(isoDay);
const seedSeason = async () => {
    const midnight = (offset) => { const d = new Date(Date.now() + offset * 86400000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
    await require('../models/admin').deleteMany({});
    await require('../models/admin').create({ seasonStartDate: midnight(-30), seasonEndDate: midnight(200) });
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
const paidSession = (id, overrides = {}) => ({
    id, object: 'checkout.session', payment_status: 'paid',
    metadata: { timeslot: '11am', firstName: 'Carol', lastName: 'Charter', email: `carol${++seq}@example.test`, phone: '1', adults: '2', children: '0', date: day(12), accommodation: '', message: '', charter: 'true', ...overrides },
});

module.exports = { dbUri, OWNER, PASSWORD, USERNAME, WEBHOOK_SECRET, setEnv, installMocks, startDb, stopDb, resetDb, seedSeason, day, shown, call, login, booking, insertBooking, findBooking, seatsLeft, webhook, paidSession };
