// The public booking page, as a customer sees it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request }) => { await h.reset(request); });

test('the page loads with the calendar and seat counts, and nothing is blocked or broken', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/bookings');
    await expect(page.locator('.react-calendar')).toBeVisible();
    await expect(page.locator('.calendarDisplay')).toContainText('12 spaces available');
    expect(problems).toEqual([]);
});

test('a customer can make a booking, and both the customer and the owner are emailed', async ({ page, request }) => {
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    const email = await h.fillBooking(page, { firstName: 'Alice', email: 'alice@example.test', adults: '2' });
    await page.click('button:has-text("Confirm Booking")');
    await expect(page.locator('.responseDisplay h3')).toContainText('has been reserved');
    // stored as YYYY-MM-DD, but a customer reads it day-month-year
    const british = date.split('-').reverse().join('-');
    await expect(page.locator('.responseDisplay')).toContainText(`on ${british} at 11am`);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const saved = await h.savedBookings(request);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ date, firstName: 'Alice', adults: 2, timeslot: '11am', status: 'active' });
    const sent = (await h.mails(request)).filter((m) => m.result === 'sent').map((m) => m.to).sort();
    expect(sent).toEqual([email, 'sarkboattrips@gmail.com'].sort());

    await page.click('.responseDisplay button');
    await expect(page.locator('#firstName')).toHaveValue('');
});

test('a booking the server refuses shows the reason and keeps what the customer typed', async ({ page, request }) => {
    await page.goto('/bookings');
    await h.pickDate(page, 9);
    await h.fillBooking(page, { email: 'first@example.test', adults: '12' });
    await page.click('button:has-text("Confirm Booking")');
    await expect(page.locator('.responseDisplay h3')).toContainText('has been reserved');
    await page.click('.responseDisplay button');

    await h.fillBooking(page, { firstName: 'Latecomer', email: 'late@example.test', adults: '2' });
    await page.click('button:has-text("Confirm Booking")');
    await expect(page.locator('.responseDisplay h3')).toContainText('No spaces available');
    await page.click('.responseDisplay button');
    await expect(page.locator('#firstName')).toHaveValue('Latecomer');
    expect(await h.savedBookings(request)).toHaveLength(1);
});

test('a bot that fills in the hidden field is not seen by people, and gets nothing saved', async ({ page, request }) => {
    await page.goto('/bookings');
    const box = await page.locator('#website_url').boundingBox();
    expect(box.x).toBeLessThan(-1000); // off the screen
    await expect(page.locator('#website_url')).toHaveAttribute('tabindex', '-1');
    const response = await request.post('/bookings/add', { data: { date: '2099-01-01', timeslot: '11am', firstName: 'Bot', lastName: 'Bot', email: 'bot@example.test', phone: '1', adults: '2', website_url: 'http://spam.example' } });
    expect((await response.json()).ok).toBe(true);
    expect(await h.savedBookings(request)).toHaveLength(0);
});

test('on a phone nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/', '/bookings', '/charters', '/dashboard']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle').catch(() => {});
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        // a few pixels are tolerated: one review card on the home page sticks out by 1.5px, which the page already hides
        expect(overflow, `${path} is wider than the screen`).toBeLessThanOrEqual(4);
    }
});
