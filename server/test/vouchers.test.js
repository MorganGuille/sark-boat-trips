// Gift vouchers (owner's decisions, 2 Nov 2026): for people on a trip at the normal prices, or a
// private charter; valid until 1 October of the next season; bought online (paid at once on Stripe's
// page) or made on the dashboard; used by the owner against a booking.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { voucherExpiry, coversText, newVoucherCode, tidyCode, voucherProblem, runDueVoucherEmails, MAX_SEND_ATTEMPTS } = require('../utils/vouchers');
const { runDueCharges } = require('../utils/charges');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const PRICES = { adult: 4000, child: 2500, charter: 40000 };
const vouchers = () => db.collection('vouchers').find({}).toArray();
const voucherMails = (to) => mocks.sent(to).filter((m) => m.attachments.some((a) => /gift-voucher/.test(a.filename || '')));
const pdfOf = (mail) => mail.attachments.find((a) => /\.pdf$/.test(a.filename || ''));
const dash = (method, path, body) => t.call(app, method, path, { body, token });
// A voucher made on the dashboard, paid by bank transfer, not emailed
const madeByOwner = async (fields = {}) => {
    const res = await dash('post', '/vouchers/add', { kind: 'trip', adults: '2', children: '0', recipientName: 'Jane', paidBy: 'bank', sendTo: 'none', ...fields });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.voucher;
};
const inAWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

describe('vouchers: the rules', () => {
    it('lasts until 1 October of the first season that has not started yet', () => {
        assert.equal(voucherExpiry('2026-12-25', '2026-04-01'), '2027-10-01', 'bought at Christmas');
        assert.equal(voucherExpiry('2026-07-10', '2026-04-01'), '2027-10-01', 'bought during the season: the rest of it and all of next');
        assert.equal(voucherExpiry('2027-02-10', '2027-04-01'), '2027-10-01', "bought before this year's season opens");
        assert.equal(voucherExpiry('2027-02-10', '2026-04-01'), '2027-10-01', "this year's season not set on the dashboard yet");
        assert.equal(voucherExpiry('2027-10-05', '2026-04-01'), '2028-10-01', "after 1 October, this year's season is over");
        assert.equal(voucherExpiry('2026-12-25', null), '2027-10-01', 'no season on the dashboard');
    });
    it('says what it covers in words', () => {
        assert.equal(coversText({ kind: 'trip', adults: 2, children: 0 }), '2 adults');
        assert.equal(coversText({ kind: 'trip', adults: 1, children: 2 }), '1 adult and 2 children');
        assert.equal(coversText({ kind: 'trip', adults: 0, children: 1 }), '1 child');
        assert.equal(coversText({ kind: 'charter' }), 'Private charter for up to 12 people');
    });
    it('codes are easy to read out, and the owner can type them any old way', () => {
        assert.match(newVoucherCode(), /^GIFT-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/);
        assert.equal(tidyCode('gift 7kq4 m2'), 'GIFT-7KQ4-M2');
        assert.equal(tidyCode('7KQ4M2'), 'GIFT-7KQ4-M2');
        assert.equal(tidyCode('7KQ4'), null);
    });
    it('checks an order: who it is for, how many, where it goes and when', () => {
        const ok = t.voucherOrder();
        assert.equal(voucherProblem(ok), null);
        assert.match(voucherProblem({ ...ok, recipientName: '' }), /who the voucher is for/);
        assert.match(voucherProblem({ ...ok, adults: '0' }), /at least one person/);
        assert.match(voucherProblem({ ...ok, adults: '10', children: '3' }), /up to 12 people/);
        assert.match(voucherProblem({ ...ok, adults: ['2'] }), /how many people/);
        assert.match(voucherProblem({ ...ok, kind: 'boat' }), /choose a voucher/);
        assert.match(voucherProblem({ ...ok, buyerEmail: 'nope' }), /valid email/);
        assert.match(voucherProblem({ ...ok, sendTo: 'recipient' }), /email address of the person/);
        assert.match(voucherProblem({ ...ok, sendTo: 'recipient', recipientEmail: 'j@example.test', sendOn: '2020-01-01' }), /already passed/);
        assert.match(voucherProblem({ ...ok, recipientName: ['Jane'] }), /check the details/);
        assert.match(voucherProblem({ ...ok, message: 'x'.repeat(301) }), /shorter/);
        assert.equal(voucherProblem({ kind: 'charter' }, { owner: true }), null, 'on the dashboard only what it covers is needed');
    });
});

describe('buying a voucher online', () => {
    it('sends the buyer to Stripe to pay the normal prices now, and the price is never the buyer\'s to set', async () => {
        const res = await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder({ adults: '2', children: '1', amount: '1', price: '1' }) });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const [params] = mocks.stripe.created;
        assert.equal(params.mode, 'payment');
        assert.equal(params.line_items[0].price_data.unit_amount, 2 * PRICES.adult + PRICES.child);
        assert.equal(params.line_items[0].price_data.product_data.name, 'Gift voucher: 2 adults and 1 child');
        assert.equal(params.metadata.kind, 'voucher');
        assert.match(params.success_url, /\/gift-vouchers\/thanks\?session_id=\{CHECKOUT_SESSION_ID\}$/);
        assert.match(params.custom_text.submit.message, /can't be refunded/);
        assert.match(params.metadata.expiresOn, /^\d{4}-10-01$/);
        assert.equal(mocks.stripe.customers.length, 0, 'no saved card: it is paid at once');
    });
    it('a charter voucher costs the charter price', async () => {
        await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder({ kind: 'charter', adults: '' }) });
        assert.equal(mocks.stripe.created[0].line_items[0].price_data.unit_amount, PRICES.charter);
    });
    it('refuses a bad order, and is closed until the prices are set', async () => {
        const bad = await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder({ recipientName: '' }) });
        assert.equal(bad.status, 400);
        await db.collection('admins').updateOne({}, { $unset: { adultPrice: '' } });
        const closed = await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder() });
        assert.equal(closed.status, 503);
        assert.equal(mocks.stripe.created.length, 0);
    });
    it('drops a bot that fills in the hidden field', async () => {
        const res = await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder({ website_url: 'http://spam.test' }) });
        assert.equal(res.body.ok, false);
        assert.equal(mocks.stripe.created.length, 0);
    });
    it('once paid, makes one voucher and emails it to the buyer with the PDF, and tells the owner', async () => {
        const { voucher, session } = await t.buyVoucher(app, t.voucherOrder({ buyerEmail: 'tom@example.test' }));
        assert.ok(voucher, 'a voucher was made');
        assert.deepEqual([voucher.paidBy, voucher.amountPaid, voucher.status, voucher.kind, voucher.adults, voucher.recipientName], ['online', 8000, 'unused', 'trip', 2, 'Jane']);
        assert.equal(voucher.expiresOn, session.metadata.expiresOn, 'the date the buyer was shown');
        assert.ok(voucher.sentAt instanceof Date);
        const [mail] = voucherMails('tom@example.test');
        assert.ok(mail, 'the buyer got the voucher');
        assert.match(mail.subject, /gift voucher/i);
        assert.ok(mail.text.includes(voucher.code));
        assert.ok(pdfOf(mail).content.subarray(0, 4).equals(Buffer.from('%PDF')), 'a real PDF is attached');
        const [owner] = mocks.sent(t.OWNER);
        assert.match(owner.subject, /^Gift voucher sold: 2 adults for Jane, £80$/);

        // Stripe sends the same event again, and the buyer's thank-you page asks too: still one voucher, no more emails
        const sent = mocks.mails.length;
        await t.webhook(app, session);
        const thanks = await t.call(app, 'get', `/vouchers/verify?session_id=${session.id}`);
        assert.equal(thanks.body.code, voucher.code);
        assert.equal((await vouchers()).length, 1);
        assert.equal(mocks.mails.length, sent);
    });
    it('the thank-you page can make the voucher if the webhook has not arrived', async () => {
        const res = await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder() });
        const params = mocks.stripe.created[0];
        const id = res.body.url.split('/').pop();
        mocks.stripe.sessions[id] = { id, mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 8000, payment_intent: 'pi_x', metadata: params.metadata };
        const thanks = await t.call(app, 'get', `/vouchers/verify?session_id=${id}`);
        assert.equal(thanks.body.ok, true);
        assert.equal(thanks.body.covers, '2 adults');
        assert.equal((await vouchers()).length, 1);
    });
    it('makes nothing if the payment did not go through, or the session is not a voucher', async () => {
        const res = await t.call(app, 'post', '/vouchers/checkout', { body: t.voucherOrder() });
        const id = res.body.url.split('/').pop();
        mocks.stripe.sessions[id] = { id, mode: 'payment', status: 'open', payment_status: 'unpaid', metadata: mocks.stripe.created[0].metadata };
        const unpaid = await t.call(app, 'get', `/vouchers/verify?session_id=${id}`);
        assert.equal(unpaid.body.ok, false);
        mocks.stripe.sessions.cs_trip = { id: 'cs_trip', mode: 'setup', status: 'complete', metadata: { kind: 'trip' } };
        assert.equal((await t.call(app, 'get', '/vouchers/verify?session_id=cs_trip')).status, 404);
        assert.equal((await vouchers()).length, 0);
    });
    it('sent straight to the person it is for: they get the voucher, the buyer a receipt', async () => {
        await t.buyVoucher(app, t.voucherOrder({ buyerEmail: 'tom@example.test', sendTo: 'recipient', recipientEmail: 'jane@example.test' }));
        const [gift] = voucherMails('jane@example.test');
        assert.match(gift.subject, /A gift for you/);
        assert.ok(gift.text.includes('Tom Le Page has given you a boat trip'));
        assert.ok(gift.text.includes('Happy birthday!'));
        const [receipt] = voucherMails('tom@example.test');
        assert.match(receipt.subject, /receipt/);
        assert.ok(receipt.text.includes("We've emailed it to jane@example.test"));
    });
    it('sent on a later day: at 8am that day (Guernsey time), once, tried again if it fails, then the owner is told', async () => {
        const { voucher } = await t.buyVoucher(app, t.voucherOrder({ buyerEmail: 'tom@example.test', sendTo: 'recipient', recipientEmail: 'jane@example.test', sendOn: inAWeek }));
        assert.equal(voucherMails('jane@example.test').length, 0, 'not yet');
        assert.ok(voucherMails('tom@example.test')[0].text.includes("We'll email it to jane@example.test on"));
        assert.equal(voucher.sentAt, undefined);

        const hour = (h) => new Date(`${inAWeek}T${String(h).padStart(2, '0')}:00:00Z`);
        assert.deepEqual(await runDueVoucherEmails(new Date(`${inAWeek}T06:59:00Z`)), { sent: 0, failed: 0 }, 'before 8am, summer or winter');
        mocks.failTo.add('jane@example.test');
        for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
            assert.deepEqual(await runDueVoucherEmails(hour(9)), { sent: 0, failed: 1 }, `attempt ${attempt} fails`);
        }
        assert.deepEqual(await runDueVoucherEmails(hour(9)), { sent: 0, failed: 0 }, 'given up');
        assert.ok(mocks.sent(t.OWNER).some((m) => /NOT emailed/.test(m.subject)));
    });
    it('a later-day voucher that sends works first time, and never twice', async () => {
        await t.buyVoucher(app, t.voucherOrder({ sendTo: 'recipient', recipientEmail: 'jane@example.test', sendOn: inAWeek }));
        assert.deepEqual(await runDueVoucherEmails(new Date(`${inAWeek}T09:00:00Z`)), { sent: 1, failed: 0 });
        assert.deepEqual(await runDueVoucherEmails(new Date(`${inAWeek}T09:01:00Z`)), { sent: 0, failed: 0 });
        assert.equal(voucherMails('jane@example.test').length, 1);
    });
});

describe('vouchers on the dashboard', () => {
    it('only the owner can list, make, use or print them', async () => {
        for (const [method, path] of [['get', '/vouchers'], ['post', '/vouchers/add'], ['post', '/vouchers/use'], ['post', '/vouchers/undo'], ['post', '/vouchers/resend'], ['post', '/vouchers/extend'], ['get', '/vouchers/000000000000000000000000/pdf']]) {
            assert.equal((await t.call(app, method, path, { body: {} })).status, 401, path);
        }
    });
    it('makes one paid by bank transfer at the normal price, or a free prize, with the usual expiry or the owner\'s', async () => {
        const bank = await madeByOwner();
        assert.deepEqual([bank.paidBy, bank.amountPaid, bank.status, bank.covers], ['bank', 8000, 'unused', '2 adults']);
        assert.match(bank.expiresOn, /^\d{4}-10-01$/);
        const prize = await madeByOwner({ kind: 'charter', paidBy: 'free', expiresOn: '2030-06-30', recipientName: '' });
        assert.deepEqual([prize.amountPaid, prize.expiresOn, prize.covers], [0, '2030-06-30', 'Private charter for up to 12 people']);
        const typed = await madeByOwner({ paidBy: 'cash', amountPaid: '75' });
        assert.equal(typed.amountPaid, 7500);
        assert.equal(mocks.mails.length, 0, 'not emailed when the owner chose not to');
        const listed = await dash('get', '/vouchers');
        assert.equal(listed.body.vouchers.length, 3);
        assert.equal((await dash('get', `/vouchers?q=${encodeURIComponent(bank.code.toLowerCase())}`)).body.vouchers.length, 1);
        assert.equal((await dash('get', '/vouchers?q=jane')).body.vouchers.length, 2);
    });
    it('emails one the owner made, when asked, and refuses to without an address', async () => {
        const res = await dash('post', '/vouchers/add', { kind: 'trip', adults: '1', paidBy: 'bank', sendTo: 'buyer' });
        assert.equal(res.status, 400);
        await madeByOwner({ sendTo: 'buyer', buyerEmail: 'ann@example.test' });
        assert.equal(voucherMails('ann@example.test').length, 1);
        assert.equal(mocks.sent(t.OWNER).length, 0, 'the owner made it, so no owner email');
    });
    it('used for a booking: covers the people on it, and the rest is still to pay', async () => {
        const id = await t.insertBooking({ adults: 2, children: 1, prices: PRICES, reference: 'SBT-AAAAAA', paymentStatus: 'unpaid' });
        const voucher = await madeByOwner();
        const res = await dash('post', '/vouchers/use', { _id: voucher._id, reference: 'sbt-aaaaaa' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.match(res.body.data, /covers £80\. £25 still to pay/);
        const b = await t.findBooking(id);
        assert.deepEqual([b.voucher.code, b.voucher.value, b.paymentStatus], [voucher.code, 8000, 'unpaid']);
        const day = await dash('get', `/bookings/${b.date}`);
        assert.equal(day.body.data.find((x) => x._id === id).amountDue, 2500, 'the dashboard shows what is left to collect');
        assert.equal(res.body.voucher.status, 'used');
        assert.equal(res.body.voucher.bookingReference, 'SBT-AAAAAA');
    });
    it('a voucher that covers the whole booking marks it paid, so its saved card is never charged', async () => {
        const id = await t.insertBooking({ date: '2030-07-10', adults: 2, prices: PRICES, reference: 'SBT-BBBBBB', paymentStatus: 'card_saved', stripeCustomerId: 'cus_a', stripePaymentMethodId: 'pm_a' });
        const voucher = await madeByOwner({ adults: '3' });
        await dash('post', '/vouchers/use', { _id: voucher._id, reference: 'SBT-BBBBBB' });
        assert.equal((await t.findBooking(id)).paymentStatus, 'voucher');
        await runDueCharges(new Date('2030-07-10T12:00:00Z'));
        assert.equal(mocks.stripe.charges.length, 0);
    });
    it('a voucher that covers part of it: the card is charged only the rest', async () => {
        const id = await t.insertBooking({ date: '2030-07-10', adults: 2, children: 1, prices: PRICES, reference: 'SBT-CCCCCC', paymentStatus: 'card_saved', stripeCustomerId: 'cus_a', stripePaymentMethodId: 'pm_a' });
        const voucher = await madeByOwner({ adults: '1' });
        await dash('post', '/vouchers/use', { _id: voucher._id, reference: 'SBT-CCCCCC' });
        await runDueCharges(new Date('2030-07-10T12:00:00Z'));
        assert.equal(mocks.stripe.charges[0].params.amount, PRICES.adult + PRICES.child);
        assert.equal((await t.findBooking(id)).amountPaid, PRICES.adult + PRICES.child);
    });
    it('can be used on its own, without a booking', async () => {
        const voucher = await madeByOwner();
        const res = await dash('post', '/vouchers/use', { _id: voucher._id });
        assert.equal(res.body.voucher.status, 'used');
    });
    it('refuses: used twice, expired, the wrong kind, a paid, cancelled or unknown booking', async () => {
        const voucher = await madeByOwner();
        await dash('post', '/vouchers/use', { _id: voucher._id });
        assert.equal((await dash('post', '/vouchers/use', { _id: voucher._id })).status, 409, 'already used');

        const old = await madeByOwner({ expiresOn: '2020-10-01' });
        assert.match((await dash('post', '/vouchers/use', { _id: old._id })).body.data, /expired on 01-10-2020/);

        await t.insertBooking({ adults: 2, charter: 'true', prices: PRICES, reference: 'SBT-DDDDDD' });
        await t.insertBooking({ adults: 2, prices: PRICES, reference: 'SBT-EEEEEE', paymentStatus: 'paid' });
        await t.insertBooking({ adults: 2, prices: PRICES, reference: 'SBT-FFFFFF', status: 'cancelled' });
        const fresh = await madeByOwner();
        assert.match((await dash('post', '/vouchers/use', { _id: fresh._id, reference: 'SBT-DDDDDD' })).body.data, /charter/);
        assert.match((await dash('post', '/vouchers/use', { _id: fresh._id, reference: 'SBT-EEEEEE' })).body.data, /already paid/);
        assert.match((await dash('post', '/vouchers/use', { _id: fresh._id, reference: 'SBT-FFFFFF' })).body.data, /cancelled/);
        assert.equal((await dash('post', '/vouchers/use', { _id: fresh._id, reference: 'SBT-ZZZZZZ' })).status, 404);
        const charter = await madeByOwner({ kind: 'charter' });
        await t.insertBooking({ adults: 2, prices: PRICES, reference: 'SBT-GGGGGG' });
        assert.match((await dash('post', '/vouchers/use', { _id: charter._id, reference: 'SBT-GGGGGG' })).body.data, /not a charter/);
        assert.equal((await vouchers()).filter((v) => v.status === 'used').length, 1, 'the refused ones stay unused');
    });
    it('undo frees the voucher and puts the booking back as it was', async () => {
        const id = await t.insertBooking({ date: '2030-07-10', adults: 2, prices: PRICES, reference: 'SBT-HHHHHH', paymentStatus: 'card_saved', stripeCustomerId: 'cus_a', stripePaymentMethodId: 'pm_a' });
        const voucher = await madeByOwner();
        await dash('post', '/vouchers/use', { _id: voucher._id, reference: 'SBT-HHHHHH' });
        const res = await dash('post', '/vouchers/undo', { _id: voucher._id });
        assert.match(res.body.data, /saved card/);
        assert.equal(res.body.voucher.status, 'unused');
        const b = await t.findBooking(id);
        assert.deepEqual([b.paymentStatus, b.voucher], ['card_saved', undefined]);
    });
    it('a customer cannot change or cancel a booking a voucher pays towards', async () => {
        const id = await t.insertBooking({ adults: 2, children: 1, prices: PRICES, reference: 'SBT-JJJJJJ', manageToken: 'm'.repeat(32) });
        const voucher = await madeByOwner();
        await dash('post', '/vouchers/use', { _id: voucher._id, reference: 'SBT-JJJJJJ' });
        const view = await t.call(app, 'get', `/bookings/manage/${'m'.repeat(32)}`);
        assert.equal(view.body.booking.canChange, false);
        const cancel = await t.call(app, 'post', `/bookings/manage/${'m'.repeat(32)}/cancel`, { body: {} });
        assert.notEqual(cancel.status, 200);
        assert.notEqual((await t.findBooking(id)).status, 'cancelled');
    });
    it('resends to a corrected address, extends, and prints', async () => {
        const voucher = await madeByOwner();
        const resent = await dash('post', '/vouchers/resend', { _id: voucher._id, to: 'jane@example.test' });
        assert.equal(resent.status, 200);
        assert.equal(voucherMails('jane@example.test').length, 1);
        const longer = await dash('post', '/vouchers/extend', { _id: voucher._id, expiresOn: '2031-10-01' });
        assert.equal(longer.body.voucher.expiresOn, '2031-10-01');
        assert.equal((await dash('post', '/vouchers/extend', { _id: voucher._id, expiresOn: '01-10-2031' })).status, 400);
        const pdf = await t.call(app, 'get', `/vouchers/${voucher._id}/pdf`, { token }).buffer(true).parse((res, done) => { const parts = []; res.on('data', (c) => parts.push(c)); res.on('end', () => done(null, Buffer.concat(parts))); });
        assert.equal(pdf.headers['content-type'], 'application/pdf');
        assert.ok(pdf.body.subarray(0, 4).equals(Buffer.from('%PDF')));
    });
});

describe('a booking with a voucher is cancelled: the voucher stays used until the owner frees it, so everyone is told', () => {
    const decode = (html) => html.replace(/&#39;/g, "'");
    // Ann's voucher pays for all of her booking; Bob's pays for one of his two adults, the rest is on his card
    const two = async () => {
        const ann = await t.insertBooking({ date: t.day(10), firstName: 'Ann', email: 'ann@example.test', adults: 2, prices: PRICES, reference: 'SBT-ANN222' });
        const bob = await t.insertBooking({ date: t.day(10), firstName: 'Bob', email: 'bob@example.test', adults: 2, prices: PRICES, reference: 'SBT-BBB222', paymentStatus: 'card_saved', stripeCustomerId: 'cus_b', stripePaymentMethodId: 'pm_b' });
        const whole = await madeByOwner({ adults: '2' });
        const part = await madeByOwner({ adults: '1' });
        await dash('post', '/vouchers/use', { _id: whole._id, reference: 'SBT-ANN222' });
        await dash('post', '/vouchers/use', { _id: part._id, reference: 'SBT-BBB222' });
        mocks.reset();
        return { ann, bob, whole, part };
    };

    it('cancelling one on the dashboard says which voucher to free, in the message and in the owner\'s email, and tells the customer it is still theirs', async () => {
        const { bob, part } = await two();
        const res = await dash('post', '/bookings/cancel', { _id: bob });
        assert.match(res.body.data, new RegExp(`Gift voucher ${part.code} was used on it: press Undo on the Vouchers tab so it can be used again\\.$`));
        await t.sendCancelEmails();
        const toBob = decode(mocks.sent('bob@example.test')[0].html);
        assert.match(toBob, /Your card has not been charged, and it won't be charged for this booking\. Your gift voucher hasn't been used up: please get in touch to book another day\./);
        const toOwner = mocks.sent(t.OWNER)[0].text;
        assert.match(toOwner, new RegExp(`Payment: card saved, it will not be charged\\. GIFT VOUCHER ${part.code} was used for part of it: press Undo on the Vouchers tab so it can be used again`));
        assert.equal((await vouchers()).find((v) => v.code === part.code).status, 'used', 'it is the owner who frees it');
    });

    it('a booking without a voucher says nothing about one', async () => {
        const id = await t.insertBooking({ date: t.day(10), firstName: 'Cat', email: 'cat@example.test', adults: 1, prices: PRICES });
        assert.doesNotMatch((await dash('post', '/bookings/cancel', { _id: id })).body.data, /voucher/i);
        await t.sendCancelEmails();
        assert.doesNotMatch(mocks.mails.map((m) => m.text).join(' '), /voucher/i);
    });

    it('cancelling the whole trip lists every voucher to free, whether it paid for all of a booking or part', async () => {
        const { whole, part } = await two();
        const res = await dash('post', '/bookings/cancel-trip', { date: t.day(10), timeslot: '11am', reason: 'weather' });
        assert.match(res.body.data, /2 used a gift voucher: press Undo on the Vouchers tab so they can be used again \(see your email\)\./);
        const summary = mocks.sent(t.OWNER).find((m) => /^Trip cancelled/.test(m.subject)).text;
        assert.match(summary, /GIFT VOUCHERS still marked as used \(press Undo on the Vouchers tab so they can be used again\):/);
        assert.match(summary, new RegExp(`- ${whole.code}: Ann`));
        assert.match(summary, new RegExp(`- ${part.code}: Bob`));
        for (const to of ['ann@example.test', 'bob@example.test']) {
            assert.match(decode(mocks.sent(to)[0].html), /Your gift voucher hasn't been used up/, to);
        }
    });

    it('a trip with no vouchers on it mentions none', async () => {
        await t.insertBooking({ date: t.day(10), firstName: 'Cat', email: 'cat@example.test', adults: 1, prices: PRICES });
        const res = await dash('post', '/bookings/cancel-trip', { date: t.day(10), timeslot: '11am', reason: 'weather' });
        assert.doesNotMatch(res.body.data, /voucher/i);
        assert.doesNotMatch(mocks.sent(t.OWNER)[0].text, /voucher/i);
    });
});

describe('vouchers in the monthly report', () => {
    it('counts vouchers sold (and their money) and used, and a voucher booking only counts what was left to pay', async () => {
        const month = new Date().toISOString().slice(0, 7);
        await t.buyVoucher(app, t.voucherOrder());
        const prize = await madeByOwner({ paidBy: 'free' });
        const date = `${month}-15`;
        await t.insertBooking({ date, adults: 2, children: 1, prices: PRICES, reference: 'SBT-KKKKKK' });
        await dash('post', '/vouchers/use', { _id: prize._id, reference: 'SBT-KKKKKK' });

        const res = await dash('get', `/bookings/report/${month}`);
        assert.deepEqual(res.body.vouchers, { sold: 2, income: 8000, used: 1 });
        assert.equal(res.body.total.income, PRICES.child, 'the adults were paid for by the voucher');
        assert.equal(res.body.total.adults, 2, 'but everyone still counts as a passenger');
        const csv = await t.call(app, 'get', `/bookings/report/${month}?format=csv`, { token });
        assert.match(csv.text, /\r\nGift vouchers,2,1,,,,80\.00\r\n/);
        assert.match(csv.text, /\r\nTotal with vouchers,,,,,,105\.00\r\n/);
    });
});
