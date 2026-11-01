// Each page as search engines and the first paint see it (spec P2-9). The public pages are built ahead
// to their own file (client/prerender.js) and the server sends the right one (server/routes/pages.js):
// before, every address got the home page, and React had to rebuild the page in the browser.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => { await h.asNewVisitor(page); await h.reset(request); });

// React reports a page that doesn't match what it builds as a page error, or in the console
const watchHydration = (page) => {
    const found = [];
    page.on('pageerror', (error) => { if (/hydrat/i.test(error.message)) found.push(error.message.slice(0, 160)); });
    page.on('console', (message) => { if (message.type() === 'error' && /hydrat/i.test(message.text())) found.push(message.text().slice(0, 160)); });
    return found;
};

// The text inside <div id="root"> as the server sent it, and the page's title and description
const served = async (page, url) => {
    const response = await page.request.get(url);
    const html = await response.text();
    return {
        status: response.status(),
        title: (html.match(/<title>(.*?)<\/title>/) || [])[1],
        descriptions: [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"/g)].map((m) => m[1]),
        noindex: /<meta name="robots" content="noindex"/.test(html),
        root: html.split('<div id="root">')[1]?.split('<script')[0] || '',
        emptyRoot: /<div id="root">\s*<\/div>/.test(html),
    };
};

const PUBLIC = [
    { url: '/', title: 'Sark Boat Trips', text: 'THE BEST WAY TO SEE SARK' },
    { url: '/bookings', title: 'Sark Boat Trips | Book a Trip', text: 'Loading calendar' },
    { url: '/charters', title: 'Sark Boat Trips | Charters', text: 'Private charters' },
    { url: '/terms', title: 'Sark Boat Trips | Terms and Conditions', text: 'Terms and Conditions - Sark Boat Trips' },
    { url: '/privacy', title: 'Sark Boat Trips | Privacy Policy', text: 'Privacy Policy for Sark Boat Trips' },
];

for (const { url, title, text } of PUBLIC) {
    test(`${url} arrives as its own page, with its own title and description, and React doesn't rebuild it`, async ({ page }) => {
        const html = await served(page, url);
        expect(html.status).toBe(200);
        expect(html.title).toBe(title);
        expect(html.root).toContain(text);
        expect(html.noindex).toBe(false);
        expect(html.descriptions).toHaveLength(1);

        const hydration = watchHydration(page);
        await page.goto(url);
        await page.waitForLoadState('networkidle').catch(() => {});
        expect(hydration).toEqual([]);
    });
}

test('every public page has a different description', async ({ page }) => {
    const descriptions = [];
    for (const { url } of PUBLIC) descriptions.push((await served(page, url)).descriptions[0]);
    expect(new Set(descriptions).size).toBe(PUBLIC.length);
});

test('written differently (/Bookings/), it is still the bookings page', async ({ page }) => {
    const html = await served(page, '/Bookings/');
    expect(html.title).toBe('Sark Boat Trips | Book a Trip');
});

for (const url of ['/dashboard', '/canceled?kind=trip', '/success?session_id=cs_test_nope', `/manage/${'z'.repeat(32)}`]) {
    test(`${url} is built in the browser, kept out of search results, and loads cleanly`, async ({ page }) => {
        const html = await served(page, url);
        expect(html.status).toBe(200);
        expect(html.noindex).toBe(true);
        expect(html.emptyRoot, 'empty: nothing for React to mismatch').toBe(true);
        const hydration = watchHydration(page);
        await page.goto(url);
        await expect(page.locator('h1, h2').first()).toBeVisible();
        expect(hydration).toEqual([]);
    });
}

test('an address that is not a page answers 404 (not the home page) and shows the page-not-found page', async ({ page }) => {
    const html = await served(page, '/no-such-page');
    expect(html.status).toBe(404);
    expect(html.noindex).toBe(true);
    await page.goto('/no-such-page');
    await expect(page.locator('h1')).toHaveText('404 - Adrift!');
});

test('robots.txt keeps search engines out of the dashboard and points to the sitemap, which lists the public pages', async ({ page }) => {
    const robots = await (await page.request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /dashboard');
    const sitemapLine = robots.split('\n').find((line) => line.startsWith('Sitemap: '));
    expect(sitemapLine).toMatch(/\/sitemap\.xml$/);
    const sitemap = await (await page.request.get(new URL(sitemapLine.slice(9)).pathname)).text();
    const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(paths).toEqual(PUBLIC.map((p) => p.url));
});
