// How emails look and what comes with them: the shared layout (emails/layout.js), the plain-text copy,
// the logo inside the email, the calendar file (emails/calendar.js) and dates written out in words.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { longDay, shortDay } = require('../utils/dates');
const { safeHtml, trusted } = require('../utils/safeHtml');
const { calendarFile } = require('../emails/calendar');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token;
before(async () => { await t.startDb(); await t.seedSeason(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); run++; });

const ics = (mail) => mail.attachments.find((a) => a.filename.endsWith('.ics'));
const field = (file, name) => file.content.match(new RegExp(`^${name}:(.*)$`, 'm'))?.[1];

// Customers' addresses are new for each test (online booking allows 3 per email address an hour)
let run = 0;
const who = (name) => `${name}${run}@example.test`;

// Makes one of every customer and owner email
const everyEmail = async () => {
    const trip = (await t.bookOnline(app, t.booking({ date: t.day(10), email: who('trip') }))).booking;
    await t.bookOnline(app, t.booking({ date: t.day(11), email: who('charter') }), { kind: 'charter' });
    await t.call(app, 'post', `/bookings/update/${trip._id}`, { token, body: { timeslot: '2pm' } });
    await t.call(app, 'post', '/bookings/cancel', { token, body: { _id: String(trip._id) } });
    await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(12), timeslot: '11am', adults: '1', firstName: 'Dee', email: who('dashboard') } });
    return mocks.sent();
};

describe('every email', () => {
    it('has the shared layout, a plain-text copy with the same words, and the logo travelling inside it', async () => {
        const sent = await everyEmail();
        assert.ok(sent.length >= 9, `got ${sent.length}`);
        for (const mail of sent) {
            assert.match(mail.html, /<table role="presentation"/, mail.subject);
            assert.ok(mail.html.includes('src="cid:logo@sarkboattrips"'), `${mail.subject}: logo`);
            const logo = mail.attachments.find((a) => a.cid === 'logo@sarkboattrips');
            assert.ok(logo && logo.path.endsWith('emails/logo.png'), `${mail.subject}: logo attached`);
            assert.ok(mail.text.length > 50, `${mail.subject}: plain text`);
            assert.doesNotMatch(mail.text, /<[a-z/][^>]*>|&amp;|&#39;/i, `${mail.subject}: plain text has no HTML`);
            assert.ok(mail.text.startsWith(mail.html.match(/<h1[^>]*>([^<]*)<\/h1>/)[1].replace(/&#39;/g, "'")), `${mail.subject}: same heading`);
        }
    });

    it('customer subjects never shout in capitals, and dates are written out', async () => {
        const toCustomers = (await everyEmail()).filter((m) => m.to !== t.OWNER);
        for (const mail of toCustomers) {
            assert.doesNotMatch(mail.subject, /\b[A-Z]{3,}\b/, mail.subject);
            assert.doesNotMatch(mail.subject + mail.text, /\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2}/, `${mail.subject}: a numeric date`);
        }
        assert.ok(toCustomers.some((m) => m.subject.includes(shortDay(t.day(10)))));
    });

    it('customer emails end with how to reach us; the owner\'s own emails don\'t need it', async () => {
        for (const mail of await everyEmail()) {
            const footer = /\+44 7911 764 246 \| hello@sarkboattrips\.test$/.test(mail.text);
            assert.equal(footer, mail.to !== t.OWNER, mail.subject);
        }
    });

    it('owner emails have a dashboard button', async () => {
        for (const mail of (await everyEmail()).filter((m) => m.to === t.OWNER)) {
            assert.ok(mail.html.includes('href="http://localhost:5173/dashboard"'), mail.subject);
            assert.match(mail.text, /Open the dashboard: http:\/\/localhost:5173\/dashboard/, mail.subject);
        }
    });

    it('owner subjects say who, how many and when (one person is a person)', async () => {
        await t.bookOnline(app, t.booking({ date: t.day(10), firstName: 'Solo', lastName: 'Sailor', adults: '1' }));
        assert.equal(mocks.sent(t.OWNER)[0].subject, `New booking: Solo Sailor, 1 person, 11am ${shortDay(t.day(10))}`);
    });
});

describe('the calendar file', () => {
    it('comes with the confirmation and the change, not with the cancellation', async () => {
        await everyEmail();
        const subjects = (who) => mocks.sent(who).map((m) => [m.subject.split(' ').slice(0, 3).join(' '), Boolean(ics(m))]);
        assert.deepEqual(subjects(who('trip')), [['Your boat trip', true], ['Your booking has', true], ['Your boat trip', false]]);
        assert.ok(ics(mocks.sent(who('charter'))[0]));
        assert.ok(ics(mocks.sent(who('dashboard'))[0]), 'dashboard bookings get one too');
        for (const m of mocks.sent(t.OWNER)) assert.equal(ics(m), undefined, m.subject);
    });

    it('a change replaces the same calendar entry: same id, later version, new time', async () => {
        const trip = (await t.bookOnline(app, t.booking({ date: t.day(10), email: who('trip') }))).booking;
        const first = ics(mocks.sent(who('trip'))[0]);
        await new Promise((resolve) => setTimeout(resolve, 1100)); // the version is counted in seconds
        await t.call(app, 'post', `/bookings/update/${trip._id}`, { token, body: { timeslot: '2pm' } });
        const second = ics(mocks.sent(who('trip'))[1]);
        assert.equal(field(second, 'UID'), `booking-${trip._id}@sarkboattrips.test`);
        assert.equal(field(first, 'UID'), field(second, 'UID'));
        assert.ok(Number(field(second, 'SEQUENCE')) > Number(field(first, 'SEQUENCE')));
        assert.notEqual(field(first, 'DTSTART'), field(second, 'DTSTART'));
    });

    it('starts at the trip time in Guernsey (summer and winter) and lasts 2.5 hours, or 3 for a charter', () => {
        const summer = calendarFile({ _id: 'a1', date: '2027-07-15', timeslot: '11am', adults: 2, charter: 'false' });
        assert.deepEqual([field(summer, 'DTSTART'), field(summer, 'DTEND')], ['20270715T100000Z', '20270715T123000Z']);
        const winter = calendarFile({ _id: 'a2', date: '2027-01-15', timeslot: '2pm', adults: 2, charter: 'false' });
        assert.deepEqual([field(winter, 'DTSTART'), field(winter, 'DTEND')], ['20270115T140000Z', '20270115T163000Z']);
        const charter = calendarFile({ _id: 'a3', date: '2027-07-15', timeslot: '2pm', adults: 6, charter: 'true' });
        assert.deepEqual([field(charter, 'DTSTART'), field(charter, 'DTEND')], ['20270715T130000Z', '20270715T160000Z']);
        assert.equal(field(charter, 'SUMMARY'), 'Sark Boat Trips: private charter');
    });

    it('is a proper calendar file: the right type, line endings, escaping and line lengths', () => {
        const file = calendarFile({ _id: 'b1', date: '2027-07-15', timeslot: '11am', adults: 2, children: 1, charter: 'false' });
        assert.equal(file.contentType, 'text/calendar; charset=utf-8; method=PUBLISH');
        assert.equal(file.filename, 'sark-boat-trip.ics');
        assert.match(file.content, /^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR\r\n$/);
        assert.doesNotMatch(file.content.replace(/\r\n/g, ''), /\n/, 'every line ends with CRLF');
        assert.equal(field(file, 'LOCATION'), 'Creux Harbour\\, Sark');
        for (const line of file.content.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `too long: ${line}`);
        // the folded description unfolds back to the whole sentence
        const description = file.content.replace(/\r\n /g, '').match(/^DESCRIPTION:(.*)$/m)[1];
        assert.equal(description, 'Please be at the Creux Harbour shortly before 11am. Questions? Call +44 7911 764 246 or email hello@sarkboattrips.test.');
        assert.equal(field(file, 'SUMMARY'), 'Sark Boat Trips: boat trip (2 adults and 1 child)');
    });

    it('is left out when a booking has no proper date or time (old or incomplete dashboard bookings)', () => {
        assert.equal(calendarFile({ _id: 'c1', date: '', timeslot: '11am' }), null);
        assert.equal(calendarFile({ _id: 'c2', date: '2027-07-15', timeslot: 'noon' }), null);
    });
});

describe('dates in emails', () => {
    it('are written out with the weekday, and shortened for subjects', () => {
        assert.equal(longDay('2026-11-09'), 'Monday 9 November 2026');
        assert.equal(shortDay('2026-11-09'), 'Mon 9 Nov');
        assert.equal(longDay('2028-02-29'), 'Tuesday 29 February 2028');
        assert.equal(longDay('2027-01-03'), 'Sunday 3 January 2027');
        assert.equal(longDay('not a date'), 'not a date');
    });
});

describe('the escaping tag', () => {
    it('keeps HTML it built itself, but still escapes anything else, in lists too', () => {
        const inner = safeHtml`<b>${'<i>x</i>'}</b>`;
        assert.equal(safeHtml`<p>${trusted(inner)}</p>`, '<p><b>&lt;i&gt;x&lt;/i&gt;</b></p>');
        assert.equal(safeHtml`<p>${inner}</p>`, '<p>&lt;b&gt;&amp;lt;i&amp;gt;x&amp;lt;/i&amp;gt;&lt;/b&gt;</p>', 'not marked trusted: escaped again');
        assert.equal(safeHtml`${['<a>', trusted('<br>')]}`, '&lt;a&gt;<br>');
    });
});
