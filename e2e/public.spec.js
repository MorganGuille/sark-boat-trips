// The public booking page, as a customer sees it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => { await h.asNewVisitor(page); await h.reset(request); });

test('the page loads with the calendar and seat counts, and nothing is blocked or broken', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/bookings');
    await expect(page.locator('.react-calendar')).toBeVisible();
    await expect(page.locator('.calendarDisplay')).toContainText('12 spaces available');
    // the prices come from the owner's settings, not from the page
    const prices = page.locator('[aria-label="Pricing information"]');
    await expect(prices).toContainText('Adults: £40');
    await expect(prices).toContainText('Children (3-14 yrs): £25');
    await expect(prices).toContainText('Private Charter: £400');
    expect(problems).toEqual([]);
});

test('a customer saves a card on Stripe\'s page, comes back to a confirmation, and both sides are emailed', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    const email = await h.fillBooking(page, { firstName: 'Alice', email: 'alice@example.test', adults: '2' });
    await expect(page.locator('.cardNotice')).toContainText('Nothing is charged now');
    await page.click('button:has-text("Continue to card details")');
    await page.waitForURL('https://checkout.stripe.test/**');
    expect(await h.savedBookings(request), 'nothing is booked until the card is saved').toHaveLength(0);

    // the customer saves their card on Stripe and is sent back
    const { id } = await (await request.post('/__test/complete-checkout')).json();
    await page.goto(`/success?session_id=${id}`);
    await expect(page.locator('h1')).toHaveText('Success!');
    // stored as YYYY-MM-DD, but a customer reads it day-month-year
    const british = date.split('-').reverse().join('-');
    await expect(page.locator('main')).toContainText(`booked for 11am on ${british}`);
    await expect(page.locator('main')).toContainText('Visa •••• 4242');
    await expect(page.locator('main')).toContainText('nothing has been taken yet');
    await expect(page.locator('main')).toContainText('£80 will be charged when your trip starts');

    const saved = await h.savedBookings(request);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ date, firstName: 'Alice', adults: 2, timeslot: '11am', status: 'active', paymentStatus: 'card_saved' });
    const sent = (await h.mails(request)).filter((m) => m.result === 'sent').map((m) => m.to).sort();
    expect(sent).toEqual([email, 'sarkboattrips@gmail.com'].sort());

    await page.reload();
    await expect(page.locator('h1')).toHaveText('Success!');
    expect(await h.savedBookings(request), 'a refresh makes no second booking').toHaveLength(1);
});

test('a booking the server refuses shows the reason and keeps what the customer typed', async ({ page, request }) => {
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    await request.post('/__test/insert-booking', { data: { date, adults: 12 } }); // the 11am trip is now full
    await h.fillBooking(page, { firstName: 'Latecomer', email: 'late@example.test', adults: '2' });
    await page.click('button:has-text("Continue to card details")');
    await expect(page.locator('.responseDisplay h3')).toContainText('No spaces available');
    await page.click('.responseDisplay button');
    await expect(page.locator('#firstName')).toHaveValue('Latecomer');
    expect(await h.savedBookings(request)).toHaveLength(1);
});

test('closing Stripe\'s page leads to a page saying nothing was booked or charged', async ({ page }) => {
    await page.goto('/canceled');
    await expect(page.locator('main')).toContainText('nothing has been booked');
    await expect(page.locator('main')).toContainText('nothing has been charged');
});

test('a bot that fills in the hidden field is not seen by people, and gets nothing saved', async ({ page, request }) => {
    await page.goto('/bookings');
    const box = await page.locator('#website_url').boundingBox();
    expect(box.x).toBeLessThan(-1000); // off the screen
    await expect(page.locator('#website_url')).toHaveAttribute('tabindex', '-1');
    const response = await request.post('/bookings/checkout', { data: { date: '2099-01-01', timeslot: '11am', firstName: 'Bot', lastName: 'Bot', email: 'bot@example.test', phone: '1', adults: '2', website_url: 'http://spam.example' } });
    expect((await response.json()).url).toBeUndefined();
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
