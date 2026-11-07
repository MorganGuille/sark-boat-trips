// Private charters: the customer saves a card on Stripe's page (faked: the real page is never visited).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => { await h.asNewVisitor(page); await h.reset(request); });

const submitCharter = async (page) => {
    await page.goto('/charters');
    await h.pickDate(page, 20);
    await h.fillBooking(page, { adults: '4' });
    await page.click('button:has-text("Continue to card details")');
};

// The address the owner's email link goes to, and the subject it starts with, as a person reads them
const otherTimeLink = async (page) => {
    const link = page.locator('.otherTime a');
    await expect(link).toHaveText('Contact us');
    const href = decodeURIComponent(await link.getAttribute('href'));
    return href;
};
const written = (daysFromToday) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
};

test('under the times, a charter customer can email to ask for a different time, with the day in the subject', async ({ page }) => {
    await page.goto('/charters');
    await h.pickDate(page, 20);
    await expect(page.locator('.otherTime')).toHaveText('Looking for a different time? Contact us');
    expect(await otherTimeLink(page)).toMatch(new RegExp(`^mailto:[^?]+@[^?]+\\?subject=Charter on ${written(20)}, another time$`));
    // right underneath the times, in the same step
    await expect(page.locator('.tripCards + .otherTime')).toBeVisible();

    // the subject follows the day they choose
    await h.pickDate(page, 21);
    await expect.poll(() => otherTimeLink(page)).toContain(`Charter on ${written(21)}, another time`);
});

test('the different time line is still there on a day with no time free for a charter', async ({ page, request }) => {
    const d = new Date();
    d.setDate(d.getDate() + 20);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '11am', adults: 1 } });
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '2pm', adults: 1 } });
    await page.goto('/charters');
    await h.pickDate(page, 20);
    await expect(page.locator('.customerBooking')).toContainText('No timeslots available today, please choose another day.');
    expect(await otherTimeLink(page)).toContain(`Charter on ${written(20)}, another time`);
});

test('normal trips do not offer a different time', async ({ page }) => {
    await page.goto('/bookings');
    await h.pickDate(page, 20);
    await expect(page.locator('.tripCard').first()).toBeVisible();
    await expect(page.locator('.otherTime')).toHaveCount(0);
});

test('when Stripe is unavailable the customer is told clearly that nothing was charged', async ({ page, request }) => {
    await request.post('/__test/stripe-fail', { data: { fail: true } });
    await submitCharter(page);
    await expect(page.locator('.formError')).toContainText("couldn't open the card page. Nothing has been booked or charged");
});

test('with Stripe working the customer is sent to Stripe to save a card', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe checkout</h1>' }));
    await submitCharter(page);
    await page.waitForURL('https://checkout.stripe.test/**');
    expect(page.url()).toContain('cs_test_created_1');
    expect(await h.savedBookings(request), 'nothing is booked until the card is saved').toHaveLength(0);
});

test('coming back from Stripe with a saved card shows the confirmation, again after a refresh, with only one booking', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await submitCharter(page);
    await page.waitForURL('https://checkout.stripe.test/**');
    const { id } = await (await request.post('/__test/complete-checkout')).json();
    await page.goto(`/success?session_id=${id}`);
    await expect(page.locator('h1')).toHaveText('Success!');
    await expect(page.locator('main')).toContainText('Your charter is booked for 11am');
    await expect(page.locator('main')).toContainText('£400 will be charged when your charter starts');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Success!');
    const saved = await h.savedBookings(request);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ charter: 'true', paymentStatus: 'card_saved' });
});

test('an unknown booking says it could not be confirmed, that nothing was charged, and gives ways to get in touch', async ({ page }) => {
    await page.goto('/success?session_id=cs_test_nope');
    await expect(page.locator('h1')).toHaveText("We couldn't confirm your booking");
    await expect(page.locator('main')).toContainText('Nothing has been charged');
    await expect(page.locator('main a[href^="mailto:"]')).toBeVisible();
});
