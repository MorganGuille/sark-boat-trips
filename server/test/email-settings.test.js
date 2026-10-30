// Where emails come from and go to (spec P2-11): MAIL_FROM, OWNER_EMAIL and the mail server are
// settings, and no email or page has the old Gmail address typed into it any more.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { readSettings } = require('../utils/settings');
const { runDueCharges } = require('../utils/charges');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const OLD_ADDRESS = 'sarkboattrips' + '@gmail.com'; // split so this file doesn't trip its own check
const SENDER = `Sark Boat Trips <${t.MAIL_FROM}>`;

let token;
before(async () => { await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

describe('the email settings', () => {
    it('send through SMTP_HOST as MAIL_FROM, port 465 encrypted from the start', () => {
        const { mail } = readSettings({ MAIL_FROM: 'info@example.test', SMTP_HOST: 'smtp.zoho.eu', SMTP_PASSWORD: 'pw' });
        assert.deepEqual(mail.transport, { host: 'smtp.zoho.eu', port: 465, secure: true, auth: { user: 'info@example.test', pass: 'pw' } });
        assert.equal(mail.sender, 'Sark Boat Trips <info@example.test>');
        assert.equal(mail.owner, 'info@example.test', 'owner alerts go to MAIL_FROM unless OWNER_EMAIL is set');
    });

    it('port 587 switches to encryption after connecting, and SMTP_USER and OWNER_EMAIL override', () => {
        const { mail } = readSettings({ MAIL_FROM: 'info@example.test', OWNER_EMAIL: 'me@example.test', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'login@example.test', SMTP_PASSWORD: 'pw' });
        assert.deepEqual(mail.transport, { host: 'smtp.example.test', port: 587, secure: false, auth: { user: 'login@example.test', pass: 'pw' } });
        assert.equal(mail.owner, 'me@example.test');
    });

    it('without SMTP_HOST it still sends through Gmail with the old settings (production until it is switched)', () => {
        const { mail, warnings } = readSettings({ gmail_address: 'old@gmail.example', gmail_password: 'pw' });
        assert.deepEqual(mail.transport, { service: 'gmail', auth: { user: 'old@gmail.example', pass: 'pw' } });
        assert.equal(mail.from, 'old@gmail.example');
        assert.equal(mail.owner, 'old@gmail.example');
        assert.ok(!warnings.some((w) => /MAIL_FROM|SMTP/.test(w)));
    });

    it('warns at startup when no email can be sent', () => {
        assert.ok(readSettings({}).warnings.some((w) => /MAIL_FROM is not set/.test(w)));
        assert.ok(readSettings({ MAIL_FROM: 'a@example.test', SMTP_HOST: 'smtp.example.test' }).warnings.some((w) => /SMTP_PASSWORD is not/.test(w)));
    });

    it('the mailer uses them (and not the Gmail settings that are also set here)', () => {
        assert.deepEqual(mocks.transport, { host: 'smtp.example.test', port: 465, secure: true, auth: { user: t.MAIL_FROM, pass: 'unused' } });
    });
});

describe('every email', () => {
    it('comes from MAIL_FROM, owner alerts go to OWNER_EMAIL, and customers are given MAIL_FROM to write to', async () => {
        // a trip and a charter booked online, one cancelled by the owner, the other's card declined
        const trip = (await t.bookOnline(app, t.booking({ date: t.day(10), email: 'trip@example.test' }))).booking;
        const charter = (await t.bookOnline(app, t.booking({ date: t.day(11), email: 'charter@example.test' }), { kind: 'charter' })).booking;
        await t.call(app, 'post', '/bookings/cancel', { token, body: { _id: String(trip._id) } });
        mocks.stripe.cards[charter.stripePaymentMethodId] = 'declined';
        assert.equal((await runDueCharges(new Date(Date.now() + 12 * 86400000))).failed, 1);

        const sent = mocks.sent();
        const subjects = sent.map((m) => `${m.to}: ${m.subject}`);
        for (const expected of [/^trip@.*Booking Confirmation/, /^charter@.*CHARTER Confirmation/, /^trip@.*CANCELLED/, /^owner@.*New Booking/, /^owner@.*New CHARTER/, /^owner@.*Booking CANCELLED/, /^owner@.*Card payment failed/]) {
            assert.ok(subjects.some((s) => expected.test(s)), `expected an email matching ${expected}, got ${subjects.join(' | ')}`);
        }
        for (const mail of sent) {
            assert.equal(mail.from, SENDER, mail.subject);
            assert.ok(!`${mail.html}${mail.text}`.includes('gmail'), `${mail.subject} mentions gmail`);
        }
        for (const mail of sent.filter((m) => m.to.startsWith('trip@') || m.to.startsWith('charter@'))) {
            assert.ok(mail.html.includes(`href="mailto:${t.MAIL_FROM}"`), `${mail.subject} gives the contact address`);
        }
    });
});

describe('the old address', () => {
    it(`appears nowhere in the website or server code (use MAIL_FROM on the server, CONTACT_EMAIL in client/src/utils/contact.js)`, () => {
        const root = path.join(__dirname, '..', '..');
        const found = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (['node_modules', 'dist', 'dist-server'].includes(entry.name)) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (/\.(js|jsx|html)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes(OLD_ADDRESS)) found.push(path.relative(root, full));
            }
        };
        ['client/src', 'client/index.html', 'server', 'e2e'].forEach((p) => {
            const full = path.join(root, p);
            if (fs.statSync(full).isDirectory()) walk(full);
            else if (fs.readFileSync(full, 'utf8').includes(OLD_ADDRESS)) found.push(p);
        });
        assert.deepEqual(found, []);
    });
});
