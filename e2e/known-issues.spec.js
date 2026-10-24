// Problems we know about, written as tests. A test marked test.fail() is EXPECTED to fail: it
// keeps the problem visible, and as soon as the problem is fixed the test starts passing, which
// shows up as a failure that tells you to delete the marker.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request }) => { await h.reset(request); });

test('the home page loads without React having to rebuild it', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(problems.hydration).toEqual([]);
});

// Spec item P2-9: the website is pre-built for the home page only, and that same page is sent for
// every address. On any other page React notices the mismatch ("Hydration failed") and rebuilds
// the page in the browser. It still works, but it is slower and search engines see the wrong page.
// When P2-9 is done, delete the test.fail() line.
for (const path of ['/charters', '/bookings', '/canceled', '/dashboard']) {
    test(`${path} loads without React having to rebuild it`, async ({ page }) => {
        test.fail();
        const problems = h.watch(page);
        await page.goto(path);
        await page.waitForLoadState('networkidle').catch(() => {});
        expect(problems.hydration).toEqual([]);
    });
}
