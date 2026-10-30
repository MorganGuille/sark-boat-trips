// Emails: a failed email never loses or hides a saved change, and nothing a customer types can
// inject markup or links into an email.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); mocks.reset(); });

const post = (path, body) => t.call(app, 'post', path, { body, token });
// A customer booking: Stripe's card page (faked) is completed, so the booking is made
const add = async (body) => (await t.bookOnline(app, body)).res;
const count = () => db.collection('bookings').countDocuments({});
const customer = (extra) => t.insertBooking({ firstName: 'Bob', lastName: 'Jones', email: 'bob@example.test', ...extra });

describe('a failed email never loses or hides a saved change', () => {
    it('online booking, customer email fails: still saved, and the owner is alerted to contact them', async () => {
        mocks.mailMode = 'client';
        const res = await add(t.booking());
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.equal(await count(), 1);
        const ownerMail = mocks.sent(t.OWNER)[0];
        assert.match(ownerMail.subject, /CUSTOMER EMAIL FAILED, please contact them/);
    });
    it('online booking, owner email fails: still saved, and the customer is still confirmed', async () => {
        mocks.mailMode = 'admin';
        const res = await add(t.booking());
        assert.equal(res.body.ok, true);
        assert.equal(await count(), 1);
        assert.equal(mocks.sent().length, 1, 'the customer email still went out');
    });
    it('online booking, every email fails: still saved and still a 200 (it used to be a 500 and the booking was lost)', async () => {
        mocks.mailMode = 'all';
        const res = await add(t.booking());
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.equal(await count(), 1);
    });
    it('dashboard add: saved, and the message says the email failed', async () => {
        mocks.mailMode = 'client';
        const res = await post('/bookings/admin-add', { date: t.day(10), timeslot: '11am', firstName: 'Bob', email: 'bob@example.test', adults: '2' });
        assert.equal(res.status, 200);
        assert.match(res.body.data, /saved, but the confirmation email could not be sent/);
        assert.equal(await count(), 1);
    });
    it('edit: the change is applied and the message says the customer email failed', async () => {
        const id = await customer({});
        mocks.mailMode = 'all';
        const res = await post(`/bookings/update/${id}`, { phone: '0999' });
        assert.equal(res.status, 200);
        assert.match(res.body.data, /updated successfully, but the email to the customer could not be sent/);
        assert.equal((await t.findBooking(id)).phone, '0999');
    });
    it('cancel and restore: both still happen', async () => {
        const id = await customer({});
        mocks.mailMode = 'all';
        const cancelled = await post('/bookings/cancel', { _id: id });
        assert.match(cancelled.body.data, /cancelled, but the email could not be sent/);
        assert.equal((await t.findBooking(id)).status, 'cancelled');
        const restored = await post('/bookings/restore', { _id: id });
        assert.match(restored.body.data, /restored, but the confirmation email could not be sent/);
        assert.equal((await t.findBooking(id)).status, 'active');
    });
    it('a charter is still saved when its emails fail, and Stripe still gets a 200', async () => {
        mocks.mailMode = 'all';
        const res = await t.webhook(app, t.cardSession('cs_test_mailfail'));
        assert.equal(res.status, 200);
        assert.equal(await db.collection('bookings').countDocuments({ stripeSessionId: 'cs_test_mailfail' }), 1);
    });
});

describe('customers cannot inject markup or links into emails', () => {
    const EVIL = {
        firstName: '<img src=x onerror=alert(1)>Bob',
        lastName: `O'Brien & Sons "Ltd"`,
        message: '<script>alert(1)</script><a href="https://evil.example/login">Click here to confirm</a>',
        accommodation: '"><b>Hotel</b>',
        phone: '+44 <1>',
    };
    const DANGEROUS = ['<script', '<img src=x', '<a href="https://evil', '<b>Hotel', '"><b>', '<1>'];
    const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const text = (html) => decode(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));

    it('through every path that sends email (online booking, dashboard add, edit, cancel, restore, charter)', async () => {
        const email = 'victim@example.test';
        assert.equal((await add({ ...t.booking(), ...EVIL, email })).body.ok, true, 'hostile text is escaped, not rejected');
        assert.equal((await post('/bookings/admin-add', { date: t.day(11), timeslot: '2pm', ...EVIL, email, adults: '2' })).body.ok, true);
        const stored = await db.collection('bookings').findOne({ date: t.day(10) });
        assert.equal(stored.message, EVIL.message, 'what the customer typed is kept exactly');
        assert.equal((await post(`/bookings/update/${stored._id}`, { phone: '07 <b>1</b>' })).body.ok, true);
        assert.equal((await post('/bookings/cancel', { _id: stored._id.toString() })).body.ok, true);
        assert.equal((await post('/bookings/restore', { _id: stored._id.toString() })).body.ok, true);
        assert.equal((await t.webhook(app, t.cardSession('cs_test_evil', { ...EVIL, email }))).status, 200);

        const emails = mocks.sent().filter((m) => m.html);
        assert.equal(emails.length, 10, 'client and owner emails across all six paths');
        for (const m of emails) {
            for (const bad of DANGEROUS) assert.ok(!m.html.includes(bad), `"${bad}" appeared in: ${m.subject}`);
            assert.ok(m.html.includes('<table role="presentation"') && m.html.includes('<h1 style='), 'the template\'s own layout is intact');
        }
        const ownerCopy = mocks.sent(t.OWNER).find((m) => /^New booking:/.test(m.subject));
        const shown = text(ownerCopy.html);
        assert.ok(shown.includes(EVIL.message) && shown.includes(EVIL.lastName) && shown.includes(EVIL.accommodation), 'the owner sees exactly what was typed');
        assert.ok(mocks.sent(email).some((m) => /Dear [^,]*Bob/.test(text(m.html))), 'apostrophes and ampersands read correctly');
    });
    it('ordinary bookings look exactly as normal', async () => {
        await add({ ...t.booking(), firstName: 'Alice', lastName: 'Smith', email: 'alice@example.test', children: '1', message: 'Looking forward to it!' });
        const c = text(mocks.sent('alice@example.test')[0].html), o = text(mocks.sent(t.OWNER)[0].html);
        assert.match(c, /Dear Alice,/);
        assert.match(c, /2 adults and 1 child/);
        assert.doesNotMatch(c, /undefined|&lt;|&amp;/);
        assert.match(o, /Alice Smith/);
        assert.match(o, /Looking forward to it!/);
    });
});
