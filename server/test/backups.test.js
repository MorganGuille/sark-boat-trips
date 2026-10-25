// The backup and restore scripts: a backup must give back exactly the same data, and restoring
// must never change or delete what is already there.
const t = require('./helpers');
t.setEnv();
t.installMocks();
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let db;
before(async () => { db = await t.startDb(); });
after(() => t.stopDb());

const SCRIPTS = path.join(__dirname, '..', 'scripts');
// each run happens in an empty folder, so no real .env is read
const node = (script, args, env = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boat-backup-run-'));
    try { return spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { cwd: dir, env: { PATH: process.env.PATH, MONGODB_URI: t.dbUri(), ...env }, encoding: 'utf8' }); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

describe('backup and restore', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'boat-backups-'));
    after(() => fs.rmSync(out, { recursive: true, force: true }));
    let folder;

    before(async () => {
        await t.resetDb();
        await db.collection('bookings').insertMany([
            { firstName: 'Ann', lastName: 'One', date: '2030-07-01', timeslot: '11am', adults: 2, children: 1, cancelledAt: new Date('2030-06-01T10:00:00Z') },
            { firstName: 'Bo', lastName: 'Two', date: '2030-07-02', timeslot: '2pm', adults: 4, children: 0 },
        ]);
        await db.collection('notes').insertOne({ date: '2030-07-01', text: 'Fuel' });
    });

    it('writes one file per collection and says what it saved', () => {
        const result = node('backup.js', ['--out', out]);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /bookings: 2/);
        assert.match(result.stdout, /notes: 1/);
        folder = path.join(out, fs.readdirSync(out)[0]);
        const info = JSON.parse(fs.readFileSync(path.join(folder, '_backup.json'), 'utf8'));
        assert.equal(info.counts.bookings, 2);
        assert.ok(fs.existsSync(path.join(folder, 'bookings.json')));
    });

    it('a restore into an empty database gives back the same ids, dates and numbers', async () => {
        const before = await db.collection('bookings').find({}).sort({ firstName: 1 }).toArray();
        await t.resetDb();
        assert.equal(await db.collection('bookings').countDocuments(), 0);

        const dry = node('restore.js', [folder]);
        assert.equal(dry.status, 0, dry.stderr);
        assert.match(dry.stdout, /bookings: 2 in the backup, 2 missing/);
        assert.equal(await db.collection('bookings').countDocuments(), 0, 'a dry run must change nothing');

        assert.equal(node('restore.js', [folder, '--apply']).status, 0);
        const after = await db.collection('bookings').find({}).sort({ firstName: 1 }).toArray();
        assert.deepEqual(after, before);
        assert.ok(after[0].cancelledAt instanceof Date);
        assert.equal(await db.collection('notes').countDocuments(), 1);
    });

    it('restoring again adds nothing, and never overwrites a change made since', async () => {
        await db.collection('bookings').updateOne({ firstName: 'Ann' }, { $set: { adults: 9 } });
        await db.collection('bookings').deleteOne({ firstName: 'Bo' });
        const result = node('restore.js', [folder, '--apply']);
        assert.match(result.stdout, /bookings: 2 in the backup, 1 missing/);
        assert.equal((await db.collection('bookings').findOne({ firstName: 'Ann' })).adults, 9, 'the newer edit is kept');
        assert.equal(await db.collection('bookings').countDocuments(), 2, 'only the deleted one came back');
    });

    it('restore refuses to run against a database that is not a sandbox one', () => {
        const result = node('restore.js', [folder, '--apply'], { MONGODB_URI: '', atlasDB_name: 'Test', atlasDB_user: 'u', atlasDB_user_password: 'p' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /refusing to connect to "Test" outside production/);
    });

    it('backup --production explains what is missing instead of guessing', () => {
        const result = node('backup.js', ['--production', '--out', out], { MONGODB_URI: '' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /atlasDB_user_prod and atlasDB_user_prod_password/);
    });

    it('asks for a backup folder if none is given', () => {
        assert.match(node('restore.js', []).stderr, /Give the backup folder/);
    });
});
