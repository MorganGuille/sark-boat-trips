// Which page the server sends for each address, robots.txt and sitemap.xml (spec P2-9). Uses a fake
// client build: one small file per page, so each answer shows which file was sent.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const t = require('./helpers');

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'boat-pages-'));
fs.mkdirSync(path.join(dist, 'pages'));
const write = (name, text) => fs.writeFileSync(path.join(dist, name), `<!doctype html><title>${text}</title>`);
write('index.html', 'PAGE home');
write('app.html', 'PAGE app');
for (const page of ['bookings', 'charters', 'terms', 'privacy']) write(`pages/${page}.html`, `PAGE ${page}`);

t.setEnv({ PUBLIC_URL: 'https://boats.example.test', CLIENT_DIST: dist });
t.installMocks();
const app = require('../app');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const get = (url) => t.call(app, 'get', url);
const sent = (res) => (res.text.match(/PAGE (\w+)/) || [])[1];

describe('the page sent for each address', () => {
    it('each public page gets its own prebuilt file, so search engines see the real page', async () => {
        for (const [url, page] of [['/', 'home'], ['/bookings', 'bookings'], ['/charters', 'charters'], ['/terms', 'terms'], ['/privacy', 'privacy']]) {
            const res = await get(url);
            assert.equal(res.status, 200, url);
            assert.equal(sent(res), page, url);
        }
    });

    it('ignores capitals and a slash at the end, as the website does (/Bookings/ is the bookings page)', async () => {
        assert.equal(sent(await get('/Bookings/')), 'bookings');
        assert.equal(sent(await get('/CHARTERS')), 'charters');
    });

    it('pages built in the browser get the empty page (marked noindex by the build)', async () => {
        for (const url of ['/dashboard', '/Dashboard/', '/success?session_id=cs_1', '/canceled?kind=trip', '/manage/abcdefghijklmnopqrstuvwxyz123456']) {
            const res = await get(url);
            assert.equal(res.status, 200, url);
            assert.equal(sent(res), 'app', url);
        }
    });

    it('an address that is not a page is a real 404, not the home page (search engines treat that as a duplicate)', async () => {
        for (const url of ['/no-such-page', '/terms/old', '/manage', '/pages/nothing']) {
            const res = await get(url);
            assert.equal(res.status, 404, url);
            assert.equal(sent(res), 'app', `${url}: React shows the "page not found" page`);
        }
    });
});

describe('robots.txt and sitemap.xml', () => {
    it('robots.txt keeps search engines out of the dashboard and manage links, and points to the sitemap', async () => {
        const res = await get('/robots.txt');
        assert.equal(res.status, 200);
        assert.match(res.headers['content-type'], /text\/plain/);
        for (const line of ['User-agent: *', 'Disallow: /dashboard', 'Disallow: /manage/', 'Sitemap: https://boats.example.test/sitemap.xml']) {
            assert.ok(res.text.split('\n').includes(line), line);
        }
    });

    it('the sitemap lists the public pages at the site\'s own address (PUBLIC_URL), and nothing private', async () => {
        const res = await get('/sitemap.xml');
        assert.equal(res.status, 200);
        assert.match(res.headers['content-type'], /xml/);
        const urls = [...res.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
        assert.deepEqual(urls, ['/', '/bookings', '/charters', '/terms', '/privacy'].map((page) => `https://boats.example.test${page}`));
    });
});
