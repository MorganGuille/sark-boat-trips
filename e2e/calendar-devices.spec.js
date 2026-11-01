// The booking calendar must block every day outside the season, on every kind of device and
// wherever the visitor is in the world. This broke once on Apple devices, because Safari reads some
// date text differently to Chrome. Playwright runs this file on Chrome, an Android phone and WebKit
// (the engine inside iPhone, iPad and Mac Safari), see playwright.config.js. It also runs in
// several time zones, because a tourist may be booking from home.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const DAY = 86400000;
const iso = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const label = (isoDay) => new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shift = (isoDay, days) => new Date(new Date(`${isoDay}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);

// A season that starts in 3 days and ends in 10 days, so there are blocked days on both sides
const START = iso(3);
const END = iso(10);

// The button for a day, or null if the calendar never shows it. It may be in the next or previous
// month, so look for it. The month arrows stop working at the edge of the season (that is blocking too).
const tile = async (page, isoDay) => {
    const button = page.locator(`button.react-calendar__tile:has(abbr[aria-label="${label(isoDay)}"])`);
    for (const move of ['next', 'next', 'prev', 'prev', 'prev', 'prev']) {
        if (await button.count()) return button.first();
        const arrow = page.locator(`.react-calendar__navigation__${move}-button`);
        if (await arrow.isEnabled()) await arrow.click();
    }
    return (await button.count()) ? button.first() : null;
};
// Blocked means the day is greyed out and can't be clicked, or is not offered at all
const expectBlocked = async (page, isoDay) => {
    const button = await tile(page, isoDay);
    if (button) await expect(button).toBeDisabled();
};
const expectOpen = async (page, isoDay) => {
    const button = await tile(page, isoDay);
    expect(button, `${isoDay} should be on the calendar`).not.toBeNull();
    await expect(button).toBeEnabled();
};

for (const timezoneId of ['Europe/London', 'America/Los_Angeles', 'Pacific/Auckland']) {
    test.describe(`in ${timezoneId}`, () => {
        test.use({ timezoneId });

        test.beforeEach(async ({ page, request }) => {
            await h.asNewVisitor(page);
            await h.reset(request);
            await request.post('/__test/season', { data: { start: START, end: END } });
        });

        test('days outside the season are blocked, and the first and last day are open', async ({ page }) => {
            await page.goto('/bookings');
            await expect(page.locator('.react-calendar')).toBeVisible();

            await expectBlocked(page, shift(START, -1));
            await expectOpen(page, START);
            await expectOpen(page, END);
            await expectBlocked(page, shift(END, 1));
            await expectBlocked(page, shift(START, -20));
            await expectBlocked(page, shift(END, 15));
        });

        test('the first day of the season can be picked, and a day before it cannot', async ({ page }) => {
            await page.goto('/bookings');
            await expectOpen(page, START);
            await (await tile(page, START)).click();
            await expect(page.locator('.tripCard').first()).toContainText(/spaces left/);
            await expect(page.locator('.chosenDay')).not.toContainText('Invalid Date');
            await expectBlocked(page, shift(START, -1));
        });

        test('once the season has begun, days already gone are blocked and today is picked to start with', async ({ page, request }) => {
            await request.post('/__test/season', { data: { start: iso(-5), end: END } });
            await page.goto('/bookings');
            await expect(page.locator('.react-calendar')).toBeVisible();
            const today = await page.evaluate(() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            });
            await expectBlocked(page, shift(today, -1));
            await expectOpen(page, today);
            const words = await page.evaluate(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
            await expect(page.locator('.chosenDay')).toHaveText(words);
        });
    });
}
