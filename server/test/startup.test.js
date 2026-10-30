// Starts the real server (index.js) the way `node index.js` does, in an empty folder with only a
// .env file, to check that settings in .env are really picked up. (An earlier change loaded .env
// too late, so a laptop silently ignored its Stripe keys; nothing else would have caught that.)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INDEX = path.join(__dirname, '..', 'index.js');
const BASE = {
    admin_username: 'owner', admin_password_hash: 'not-used-here', JWT_SECRET: 'not-used-here',
    PUBLIC_URL: 'http://localhost:5173',
};

// Runs index.js with these lines in a .env file, until it is listening (then stops it) or exits
const run = (dotenv, { useAtlas = false } = {}) => new Promise((resolve) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boat-startup-'));
    fs.writeFileSync(path.join(dir, '.env'), Object.entries(dotenv).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join('\n'));
    // only PATH is passed in, so nothing from this machine's own settings can leak into the check
    const child = spawn(process.execPath, [INDEX], { cwd: dir, env: { PATH: process.env.PATH, PORT: '0', ...(useAtlas ? {} : { MONGODB_URI: 'mongodb://127.0.0.1:1/none?serverSelectionTimeoutMS=300' }) } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const watch = setInterval(() => { if (/listening on port/.test(out)) child.kill(); }, 50);
    const giveUp = setTimeout(() => child.kill(), 20000);
    child.on('exit', (code) => { clearInterval(watch); clearTimeout(giveUp); fs.rmSync(dir, { recursive: true, force: true }); resolve({ out, code }); });
});

describe('starting the real server', () => {
    it('reads the Stripe test key and address from .env, and says online booking is on', async () => {
        const { out } = await run({ ...BASE, STRIPETESTKEY: 'sk_test_FAKE', STRIPEKEY: 'sk_live_FAKE' });
        assert.match(out, /Online booking is ON \(cards saved with Stripe test mode\), customers return to http:\/\/localhost:5173/);
        assert.match(out, /listening on port/);
    });
    it('reports CORS and any warnings from the settings in .env', async () => {
        const { out } = await run({ ...BASE, STRIPETESTKEY: 'sk_test_FAKE', PUBLIC_URL: '' });
        assert.match(out, /CORS: local development pages/);
        assert.match(out, /Warning: PUBLIC_URL is not set/);
    });
    it('a laptop with only the live key in .env has online booking switched off, and says why', async () => {
        const { out } = await run({ ...BASE, STRIPEKEY: 'sk_live_FAKE' });
        assert.match(out, /Online booking is OFF \(customers can't save a card\): only a LIVE Stripe key is available but this is not production/);
    });
    it('refuses to start without the login settings, and names the missing one', async () => {
        for (const missing of ['JWT_SECRET', 'admin_username', 'admin_password_hash']) {
            const { out, code } = await run({ ...BASE, [missing]: undefined, STRIPETESTKEY: 'sk_test_FAKE' });
            assert.equal(code, 1, missing);
            assert.match(out, new RegExp(`Missing ${missing} in environment`));
        }
    });
    it('refuses to connect a laptop to a database that is not a sandbox one, before connecting to anything', async () => {
        const { out, code } = await run({ ...BASE, STRIPETESTKEY: 'sk_test_FAKE', atlasDB_name: 'Test', atlasDB_user: 'u', atlasDB_user_password: 'p' }, { useAtlas: true });
        assert.equal(code, 1);
        assert.match(out, /refusing to connect to "Test" outside production/);
        assert.doesNotMatch(out, /listening on port|Connected to/);
    });
});
