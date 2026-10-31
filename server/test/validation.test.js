// Pure rules: no database, no server. Dates and the Guernsey clock are tested with a fixed "now".
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../utils/validateBooking');
const { readSettings } = require('../utils/settings');
const { safeHtml, escapeHtml } = require('../utils/safeHtml');

const at = (iso) => new Date(iso);

describe('calendar dates', () => {
    it('accepts real dates, including 29 February in a leap year', () => {
        assert.equal(v.dayNumber('2033-06-15'), 20330615);
        assert.equal(v.dayNumber('2032-02-29'), 20320229);
    });
    it('rejects impossible dates', () => {
        for (const d of ['2033-02-31', '2033-02-29', '2033-05-00', '2033-13-15']) assert.equal(v.dayNumber(d), null, d);
    });
    it('rejects badly formatted values, and lists or objects that merely look like a date', () => {
        for (const d of ['2033-1-1', ' 2033-06-15', '2033-06-15 ', '2033-06-15T00:00:00Z', '15-06-2033', '2033/06/15', 'banana', '', undefined, null, {}, ['2033-06-15']]) assert.equal(v.dayNumber(d), null, String(d));
    });
});

describe('the booking cutoff, in Guernsey time (summer is UTC+1, winter UTC+0)', () => {
    it('summer: the 11am trip is bookable until exactly 10:00, then closes', () => {
        assert.equal(v.whenProblem('2033-06-15', '11am', at('2033-06-15T09:00:00Z')), null);
        assert.match(v.whenProblem('2033-06-15', '11am', at('2033-06-15T09:01:00Z')), /closed/);
    });
    it('summer: the 2pm trip stays open after the 11am one has closed, and closes at 13:00', () => {
        assert.equal(v.whenProblem('2033-06-15', '2pm', at('2033-06-15T09:01:00Z')), null);
        assert.equal(v.whenProblem('2033-06-15', '2pm', at('2033-06-15T12:00:00Z')), null);
        assert.match(v.whenProblem('2033-06-15', '2pm', at('2033-06-15T12:01:00Z')), /closed/);
    });
    it('winter has no daylight saving, so the same clock time is an hour later in UTC', () => {
        assert.match(v.whenProblem('2033-01-15', '11am', at('2033-01-15T10:01:00Z')), /closed/);
        assert.equal(v.whenProblem('2033-01-15', '11am', at('2033-01-15T09:59:00Z')), null);
    });
    it('yesterday has passed and tomorrow is fine at any time', () => {
        assert.match(v.whenProblem('2033-06-14', '2pm', at('2033-06-15T09:00:00Z')), /already passed/);
        assert.equal(v.whenProblem('2033-06-16', '11am', at('2033-06-15T23:00:00Z')), null);
    });
    it('just after local midnight "today" is already the next day, even though the server clock (UTC) says otherwise', () => {
        assert.match(v.whenProblem('2033-06-14', '2pm', at('2033-06-14T23:30:00Z')), /already passed/);
        assert.equal(v.whenProblem('2033-06-15', '2pm', at('2033-06-14T23:30:00Z')), null);
    });
});

describe('the season', () => {
    const season = { start: 20330501, end: 20330930 };
    it('with no season set, bookings are not open', () => assert.match(v.seasonProblem('2033-06-15', null), /aren't open yet/));
    it('the first and last day of the season are allowed', () => {
        assert.equal(v.seasonProblem('2033-05-01', season), null);
        assert.equal(v.seasonProblem('2033-09-30', season), null);
    });
    it('the day before or after is refused, and the message names the season', () => {
        assert.match(v.seasonProblem('2033-04-30', season), /between 1 May 2033 and 30 September 2033/);
        assert.notEqual(v.seasonProblem('2033-10-01', season), null);
    });
});

describe('party size', () => {
    const party = (adults, children, required = true) => v.partyProblem({ adults, children }, { adultsRequired: required });
    it('accepts 1 to 12 adults and blank or 0 to 12 children', () => {
        assert.equal(party('1', '0'), null);
        assert.equal(party('12', ''), null);
        assert.equal(party('4', undefined), null);
        assert.equal(party('2', '12'), null);
    });
    it('rejects 0, 13, decimals, negatives and text for adults', () => {
        for (const a of ['0', '13', '2.5', '-1', 'abc', '1e1', ' ']) assert.notEqual(party(a, '0'), null, a);
    });
    it('rejects bad children', () => {
        for (const c of ['13', '-1', '1.5', 'x']) assert.notEqual(party('2', c), null, c);
    });
    it('on the dashboard a blank adults box is allowed (missing details) but 0 or 13 is not', () => {
        assert.equal(party('', '', false), null);
        assert.notEqual(party('0', '', false), null);
        assert.notEqual(party('13', '', false), null);
    });
});

describe('dashboard bookings', () => {
    it('adding needs a real date and trip time', () => {
        assert.notEqual(v.validateAdminBooking({ date: '2033-02-31', timeslot: '11am' }, { requireTrip: true }), null);
        assert.notEqual(v.validateAdminBooking({ date: '2033-06-15', timeslot: '3pm' }, { requireTrip: true }), null);
        assert.notEqual(v.validateAdminBooking({}, { requireTrip: true }), null);
    });
    it('past dates and missing details are fine', () => {
        assert.equal(v.validateAdminBooking({ date: '2020-01-01', timeslot: '2pm', adults: '', email: '' }, { requireTrip: true }), null);
    });
    it('editing only checks the fields that are filled in', () => {
        assert.equal(v.validateAdminBooking({ date: '', timeslot: '', adults: '', phone: '1' }), null);
        assert.notEqual(v.validateAdminBooking({ timeslot: 'noon' }), null);
    });
    it('rejects a bad email and a bad booking type', () => {
        assert.notEqual(v.validateAdminBooking({ email: 'nope' }), null);
        assert.notEqual(v.validateAdminBooking({ charter: 'maybe' }), null);
        assert.equal(v.validateAdminBooking({ charter: 'true' }), null);
    });
    it('never accepts lists or objects as values', () => {
        assert.notEqual(v.validateAdminBooking({ date: ['2033-06-15'], timeslot: '11am' }, { requireTrip: true }), null);
        for (const body of [{ email: ['a@b.co'] }, { adults: ['2'] }, { charter: ['true'] }, { children: { $gt: '' } }, { firstName: { $ne: null } }]) {
            assert.notEqual(v.validateAdminBooking(body), null, JSON.stringify(body));
        }
    });
    it('trip times cannot be prototype keys such as "constructor" or "__proto__"', () => {
        for (const t of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
            assert.notEqual(v.validateAdminBooking({ date: '2033-06-15', timeslot: t }, { requireTrip: true }), null, t);
        }
    });
});

describe('availability settings', () => {
    const setting = (date, timeslot, capacity) => v.validateAvailabilitySetting({ date, timeslot, capacity });
    it('accepts a capacity from 0 (closed) to 12 (the legal limit)', () => {
        assert.equal(setting('2033-06-15', '11am', '8'), null);
        assert.equal(setting('2033-06-15', '2pm', '0'), null);
        assert.equal(setting('2033-06-15', '2pm', '12'), null);
    });
    it('rejects a bad date, trip time or capacity', () => {
        assert.notEqual(setting('x', '11am', '8'), null);
        assert.notEqual(setting('2033-06-15', 'x', '8'), null);
        for (const c of ['-1', 'abc', '', '1.5', '13', '101']) assert.notEqual(setting('2033-06-15', '11am', c), null, c);
    });
});

describe('settings: which Stripe key and address are used', () => {
    const LIVE = 'sk_live_FAKE', TEST = 'sk_test_FAKE';
    const base = { PUBLIC_URL: 'https://www.example.test' };
    const s = (env) => readSettings({ ...base, ...env });

    it('production with a live key: payments on, live mode', () => {
        const r = s({ NODE_ENV: 'production', STRIPEKEY: LIVE });
        assert.equal(r.stripe.problem, null);
        assert.equal(r.stripe.mode, 'live');
        assert.equal(r.stripe.key, LIVE);
    });
    it('production ignores the test key even if it is set', () => assert.equal(s({ NODE_ENV: 'production', STRIPEKEY: LIVE, STRIPETESTKEY: TEST }).stripe.key, LIVE));
    it('anywhere else prefers the test key, so a laptop can never use the live one', () => {
        const r = s({ STRIPEKEY: LIVE, STRIPETESTKEY: TEST });
        assert.equal(r.stripe.key, TEST);
        assert.equal(r.stripe.mode, 'test');
        assert.equal(r.stripe.problem, null);
    });
    it('not production with ONLY a live key: payments off, and the live key is never handed out', () => {
        const r = s({ STRIPEKEY: LIVE });
        assert.match(r.stripe.problem, /LIVE/);
        assert.equal(r.stripe.key, null);
    });
    it('says which key is missing', () => {
        assert.match(s({}).stripe.problem, /STRIPETESTKEY is not set/);
        assert.match(s({ NODE_ENV: 'production' }).stripe.problem, /STRIPEKEY is not set/);
    });
    it('a publishable key (or junk) is rejected', () => {
        const r = s({ STRIPETESTKEY: 'pk_test_notasecretkey' });
        assert.match(r.stripe.problem, /not a secret key/);
        assert.equal(r.stripe.key, null);
    });
    it('a missing PUBLIC_URL switches online booking off; PRICE_ID is no longer needed', () => {
        assert.match(readSettings({ STRIPETESTKEY: TEST }).stripe.problem, /PUBLIC_URL is not set/);
        assert.equal(readSettings({ STRIPETESTKEY: TEST, PUBLIC_URL: 'https://x.test' }).stripe.problem, null);
        assert.equal(readSettings({ STRIPETESTKEY: TEST, PUBLIC_URL: 'https://x.test' }).priceId, undefined);
    });
    it('a PUBLIC_URL without http(s):// is rejected, and whitespace and trailing slashes are cleaned up', () => {
        assert.match(s({ STRIPETESTKEY: TEST, PUBLIC_URL: 'localhost:5173' }).stripe.problem, /must start with http/);
        const r = s({ STRIPETESTKEY: TEST, PUBLIC_URL: '  http://localhost:5173///  ' });
        assert.equal(r.publicUrl, 'http://localhost:5173');
        assert.equal(r.dashboardUrl, 'http://localhost:5173/dashboard');
    });
    it('warns when production uses a TEST key or an http address', () => {
        assert.ok(s({ NODE_ENV: 'production', STRIPEKEY: TEST }).warnings.some((w) => /TEST key/.test(w)));
        assert.ok(s({ NODE_ENV: 'production', STRIPEKEY: LIVE, PUBLIC_URL: 'http://www.example.test' }).warnings.some((w) => /not https/.test(w)));
    });
});

describe('escaping text for HTML emails', () => {
    it('escapes the five special characters', () => assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;'));
    it('turns missing values into empty text and leaves numbers alone', () => {
        assert.equal(escapeHtml(null), '');
        assert.equal(escapeHtml(undefined), '');
        assert.equal(escapeHtml(0), '0');
    });
    it('the template tag escapes values but not its own markup', () => assert.equal(safeHtml`<p>${'<b>x</b>'} ${3}</p>`, '<p>&lt;b&gt;x&lt;/b&gt; 3</p>'));
});
