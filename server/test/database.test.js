// Which database the server connects to, and the guard that keeps a laptop away from production.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readDatabase } = require('../utils/database');

const SANDBOX = { atlasDB_name: 'Bookings-Sandbox', atlasDB_user: 'sandbox-app', atlasDB_user_password: 'p@ss/word', atlasDB_password: 'old-secret' };

describe('readDatabase', () => {
    it('uses the environment\'s own user and password, and escapes odd characters in the password', () => {
        const d = readDatabase(SANDBOX);
        assert.equal(d.problem, null);
        assert.equal(d.user, 'sandbox-app');
        assert.match(d.uri, /^mongodb\+srv:\/\/sandbox-app:p%40ss%2Fword@bookingsdb\.7bty4\.mongodb\.net\/Bookings-Sandbox\?/);
        assert.doesNotMatch(d.uri, /old-secret/);
    });
    it('falls back to the original user and password until an environment has its own', () => {
        const d = readDatabase({ NODE_ENV: 'production', atlasDB_name: 'Test', atlasDB_password: 'old-secret' });
        assert.equal(d.problem, null);
        assert.match(d.uri, /^mongodb\+srv:\/\/morganguille:old-secret@/);
    });
    it('refuses a database without "sandbox" in its name outside production', () => {
        for (const atlasDB_name of ['Test', 'Bookings', undefined, '']) {
            const d = readDatabase({ ...SANDBOX, atlasDB_name });
            assert.match(d.problem, /refusing to connect to .* outside production/, String(atlasDB_name));
        }
    });
    it('allows any database name in production, and any sandbox name elsewhere', () => {
        assert.equal(readDatabase({ ...SANDBOX, NODE_ENV: 'production', atlasDB_name: 'Test' }).problem, null);
        assert.equal(readDatabase({ ...SANDBOX, atlasDB_name: 'my-sandbox-2' }).problem, null);
    });
    it('MONGODB_URI is a deliberate override and is used as given', () => {
        const d = readDatabase({ atlasDB_name: 'Test', MONGODB_URI: 'mongodb://127.0.0.1:1/x' });
        assert.deepEqual([d.uri, d.problem], ['mongodb://127.0.0.1:1/x', null]);
    });
});
