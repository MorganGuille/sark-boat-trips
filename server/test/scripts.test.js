// The one-off cleanup script for capacity settings that old charters left behind.
const t = require('./helpers');
t.setEnv();
t.installMocks();
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let db;
before(async () => { db = await t.startDb(); });
after(() => t.stopDb());

const SCRIPT = path.join(__dirname, '..', 'scripts', 'cleanup-charter-capacity.js');
const run = (...args) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boat-script-')); // an empty folder, so no real .env is read
    try { return execFileSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: { PATH: process.env.PATH, MONGODB_URI: t.dbUri() }, encoding: 'utf8' }); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const rows = () => db.collection('availabilities').find({}).toArray();

describe('cleanup-charter-capacity', () => {
    before(async () => {
        await db.collection('availabilities').insertMany([
            { date: '01-07-2030', timeslot: '11am', capacity: 4 }, // left by a cancelled charter of 4: safe to remove
            { date: '02-07-2030', timeslot: '11am', capacity: 7 }, // a capacity somebody chose, no charter: leave alone
            { date: '03-07-2030', timeslot: '2pm', capacity: 12 }, // the normal capacity: ignored
            { date: '04-07-2030', timeslot: '11am', capacity: 6 }, // an active charter of 2, so 6 is not its size: leave alone
        ]);
        await db.collection('bookings').insertMany([
            { date: '01-07-2030', timeslot: '11am', charter: 'true', adults: 3, children: 1, status: 'cancelled' },
            { date: '04-07-2030', timeslot: '11am', charter: 'true', adults: 2, children: 0, status: 'active' },
        ]);
    });

    it('a dry run lists what it would remove and what to review, and changes nothing', async () => {
        const out = run();
        assert.match(out, /report only, nothing will be changed/);
        assert.match(out, /safe to remove\): 1[\s\S]*01-07-2030 11am\s+capacity 4/);
        assert.match(out, /left alone[^\n]*: 2[\s\S]*02-07-2030 11am\s+capacity 7[\s\S]*04-07-2030 11am\s+capacity 6/);
        assert.match(out, /Run again with --apply/);
        assert.equal((await rows()).length, 4);
    });
    it('--apply removes only the row that provably came from a charter', async () => {
        const out = run('--apply');
        assert.match(out, /APPLYING changes/);
        assert.match(out, /Deleted 1 row/);
        assert.deepEqual((await rows()).map((r) => r.date).sort(), ['02-07-2030', '03-07-2030', '04-07-2030']);
    });
    it('running it again finds nothing more to remove', async () => {
        assert.match(run('--apply'), /safe to remove\): 0/);
        assert.equal((await rows()).length, 3);
    });
});
