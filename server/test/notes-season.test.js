// The owner's day notes, and the season dates.
const t = require('./helpers');
t.setEnv();
t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(() => t.resetDb());

const note = (date, content) => t.call(app, 'post', '/notes', { token, body: { date, content } });
const notesFor = async (date) => (await t.call(app, 'get', `/notes/${date}`, { token })).body.data;

describe('notes', () => {
    it('a day can have as many notes as you like, kept in the order they were written', async () => {
        for (const text of ['first', 'second', 'third']) assert.equal((await note(t.day(10), text)).status, 201);
        assert.deepEqual((await notesFor(t.day(10))).map((n) => n.content), ['first', 'second', 'third']);
    });
    it('notes belong to their own day', async () => {
        await note(t.day(10), 'today');
        await note(t.day(11), 'tomorrow');
        assert.deepEqual((await notesFor(t.day(10))).map((n) => n.content), ['today']);
        assert.deepEqual(await notesFor(t.day(12)), []);
    });
    it('a note can be deleted without touching the others', async () => {
        const { body } = await note(t.day(10), 'to delete');
        await note(t.day(10), 'to keep');
        assert.equal((await t.call(app, 'delete', `/notes/${body.data._id}`, { token })).status, 200);
        assert.deepEqual((await notesFor(t.day(10))).map((n) => n.content), ['to keep']);
    });
    it('deleting an unknown note is a 404 and a malformed id is a 400', async () => {
        assert.equal((await t.call(app, 'delete', '/notes/64b000000000000000000000', { token })).status, 404);
        assert.equal((await t.call(app, 'delete', '/notes/not-an-id', { token })).status, 400);
    });
    it('a note or a day view with a date that is not a real YYYY-MM-DD day is refused', async () => {
        for (const date of ['15-06-2033', '2033-02-31', 'today', '2033-6-5']) {
            assert.equal((await note(date, 'x')).status, 400, date);
            assert.equal((await t.call(app, 'get', `/notes/${date}`, { token })).status, 400, date);
        }
        assert.equal((await t.call(app, 'get', '/bookings/15-06-2033', { token })).status, 400);
        assert.equal(await db.collection('notes').countDocuments(), 0);
    });
    it('an empty or whitespace-only note, or one with no date, is refused', async () => {
        for (const body of [{ date: t.day(10), content: '' }, { date: t.day(10), content: '   ' }, { content: 'no date' }, { date: t.day(10) }]) {
            assert.equal((await t.call(app, 'post', '/notes', { token, body })).status, 400, JSON.stringify(body));
        }
        assert.deepEqual(await notesFor(t.day(10)), []);
    });
});

describe('season dates', () => {
    const set = (body, opts = { token }) => t.call(app, 'post', '/admin/setSeasonDates', { body, ...opts });
    const get = () => t.call(app, 'get', '/admin/getSeasonDates');

    it('anyone can read them, as plain dates', async () => {
        const res = await get();
        assert.equal(res.status, 200);
        assert.match(res.body.seasonStartDate, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(res.body.seasonEndDate, /^\d{4}-\d{2}-\d{2}$/);
    });
    it('the owner can change them, and the change is read back exactly', async () => {
        const res = await set({ seasonStartDate: '2031-05-01', seasonEndDate: '2031-09-30' });
        assert.equal(res.body.ok, true);
        assert.deepEqual([res.body.seasonStartDate, res.body.seasonEndDate], ['2031-05-01', '2031-09-30']);
        const read = await get();
        assert.deepEqual([read.body.seasonStartDate, read.body.seasonEndDate], ['2031-05-01', '2031-09-30']);
        assert.equal(await db.collection('admins').countDocuments({}), 1, 'still a single settings record');
    });
    it('missing, garbled, impossible or back-to-front dates are refused with a reason, and nothing changes', async () => {
        const before = (await get()).body;
        const bad = [
            [{}, /valid dates/], [{ seasonStartDate: 'banana', seasonEndDate: '2031-09-30' }, /valid dates/],
            [{ seasonStartDate: '2031-02-31', seasonEndDate: '2031-09-30' }, /valid dates/],
            [{ seasonStartDate: '2031-09-30', seasonEndDate: '2031-05-01' }, /on or after/],
            [{ seasonStartDate: ['2031-05-01'], seasonEndDate: '2031-09-30' }, /valid dates/],
        ];
        for (const [body, message] of bad) {
            const res = await set(body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.match(res.body.data, message);
        }
        assert.deepEqual((await get()).body, before);
    });
    it('only the owner can change them', async () => {
        assert.equal((await set({ seasonStartDate: '2031-05-01', seasonEndDate: '2031-09-30' }, {})).status, 401);
    });
    it('with no season set at all the answer is a 404 (the booking page shows "not open yet")', async () => {
        await db.collection('admins').deleteMany({});
        assert.equal((await get()).status, 404);
    });
});
