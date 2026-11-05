// Accessibility (spec P3-7): axe, the standard checker, finds nothing against WCAG 2.1 AA on any page,
// the booking steps, the manage page or any dashboard tab, at laptop and phone width. It found the
// gold and green buttons' white words too faint (fixed with the owner's option C: dark words on the
// gold, a deeper green) and the phone's sideways reviews row out of keyboard reach.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const h = require('./helpers');

const dayAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Each problem as one readable line: the rule, the element, and why
const problemsOn = async (page) => {
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    return violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} (${n.failureSummary.split('\n')[1]?.trim()})`));
};
const check = async (page, where) => expect(await problemsOn(page), where).toEqual([]);

for (const [size, viewport] of Object.entries({ laptop: { width: 1280, height: 800 }, phone: { width: 360, height: 780 } })) {
    test.describe(`on a ${size}`, () => {
        test.use({ viewport });
        test.beforeEach(async ({ request, page }) => { await h.asNewVisitor(page); await h.reset(request); });

        test('every page, the booking steps and the manage page pass the accessibility check', async ({ page, request }) => {
            for (const url of [...h.PUBLIC_PAGES, ...h.BROWSER_PAGES.filter((u) => u !== '/dashboard'), h.NOT_FOUND]) {
                await page.goto(url);
                await check(page, url);
            }
            await page.goto('/bookings');
            await h.pickDate(page, 8);
            await page.locator('.tripCard').first().click();
            await check(page, 'booking steps');

            const code = 'm'.repeat(32);
            await request.post('/__test/insert-booking', { data: { date: dayAhead(6), firstName: 'Ann', lastName: 'Smith', email: 'ann@example.test', adults: 2, paymentStatus: 'card_saved', prices: { adult: 4000, child: 2500, charter: 40000 }, manageToken: code, reference: 'SBT-ABC234' } });
            await page.goto(`/manage/${code}`);
            await page.getByRole('button', { name: 'Cancel my booking' }).waitFor();
            await check(page, 'manage my booking');
            await page.getByRole('button', { name: 'Cancel my booking' }).click();
            await page.getByRole('dialog').waitFor();
            await check(page, 'manage my booking: the "are you sure?" box');
            await page.keyboard.press('Escape');

            await page.goto('/');
            await page.getByRole('button', { name: /^Enlarge photo/ }).first().click();
            await page.getByRole('dialog').waitFor();
            await check(page, 'a photo enlarged');

            if (size === 'phone') {
                await page.goto('/');
                await page.locator('.menuButton, [aria-controls="mobile-menu"]').first().click();
                await check(page, 'phone menu open');
            }
        });

        test('the dashboard passes too: login, every tab and its forms', async ({ page, request }) => {
            await page.goto('/dashboard');
            await check(page, 'login');
            await request.post('/__test/insert-booking', { data: { date: dayAhead(0), firstName: 'Walkup', lastName: 'Jones', email: 'walk@example.test', adults: 2, reference: 'SBT-WALKUP' } });
            await h.logIn(page);
            await check(page, 'bookings');
            await page.getByRole('button', { name: /Edit season dates and prices/ }).click();
            await check(page, 'season and prices being edited');
            await page.getByRole('button', { name: /Done editing/ }).click();
            await page.locator('tr:has-text("Walkup") button:has-text("Cancel")').first().click();
            await page.getByRole('dialog').waitFor();
            await check(page, 'the "are you sure?" box');
            await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel it' }).click();
            await page.locator('.undoBar').waitFor();
            await check(page, 'the Undo bar');
            await page.locator('.undoBar button').click();
            await page.locator('.undoBar').waitFor({ state: 'detached' });
            await page.locator('tr:has-text("Walkup") button:has-text("Edit")').first().click();
            await check(page, 'editing a booking');
            await page.reload();
            await page.fill('#bookingSearch', 'walk@example.test');
            await page.click('form[role=search] button[type=submit]');
            await page.getByRole('button', { name: /Customer data for/ }).click();
            await check(page, 'search and customer data');
            for (const tab of await page.getByRole('tab').allTextContents()) {
                await page.getByRole('tab', { name: tab.trim() }).click();
                if (/Vouchers/.test(tab)) await page.getByRole('button', { name: '+ Make a voucher' }).click();
                await check(page, `${tab.trim()} tab`);
            }
        });
    });
}

test('moving through the calendar with the keyboard shows a clear outline on the day', async ({ page }) => {
    await h.asNewVisitor(page);
    await page.goto('/bookings');
    const day = page.locator('.react-calendar__tile:enabled').first();
    await day.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab'); // focus from the keyboard, as a keyboard user gets it
    const outline = await day.evaluate((el) => { const s = getComputedStyle(el); return `${s.outlineStyle} ${s.outlineWidth}`; });
    expect(outline).toBe('solid 3px');
});
