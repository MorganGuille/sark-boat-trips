// How dates are stored (YYYY-MM-DD text) and shown (dd-mm-yyyy for people in Britain)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { dayNumber, isDay, showDay } = require('../utils/dates');

describe('dates', () => {
    it('YYYY-MM-DD text sorts in date order, across months and years', () => {
        const days = ['2027-05-01', '2026-12-31', '2027-01-02', '2026-06-15', '2027-05-10'];
        assert.deepEqual([...days].sort(), ['2026-06-15', '2026-12-31', '2027-01-02', '2027-05-01', '2027-05-10']);
        assert.deepEqual([...days].sort((a, b) => dayNumber(a) - dayNumber(b)), [...days].sort());
    });
    it('"from this day onwards" and "this month" are plain searches', () => {
        const days = ['2026-12-31', '2027-01-02', '2027-05-01', '2027-05-31', '2027-06-01'];
        assert.deepEqual(days.filter((d) => d >= '2027-05-01'), ['2027-05-01', '2027-05-31', '2027-06-01']);
        assert.deepEqual(days.filter((d) => d.startsWith('2027-05-')), ['2027-05-01', '2027-05-31']);
    });
    it('shows a stored date the British way round', () => {
        assert.equal(showDay('2027-05-01'), '01-05-2027');
        assert.equal(showDay('2026-12-31'), '31-12-2026');
    });
    it('shows anything that is not a real stored date exactly as it is', () => {
        for (const odd of ['soon', '', '2027-02-30', '01-05-2027', undefined, null]) assert.equal(showDay(odd), odd);
    });
    it('knows a real day from a look-alike', () => {
        assert.equal(isDay('2032-02-29'), true);
        for (const bad of ['2033-02-29', '01-05-2027', '2027-5-1', ['2027-05-01'], 20270501]) assert.equal(isDay(bad), false, String(bad));
    });
});
