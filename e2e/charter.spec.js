// Private charters, paid through Stripe (Stripe is faked: the real checkout page is never visited).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request }) => { await h.reset(request); });

const submitCharter = async (page) => {
    await page.goto('/charters');
    await h.pickDate(page, 20);
    await h.fillBooking(page, { adults: '4' });
    await page.click('button:has-text("Confirm Booking")');
};

test('when Stripe is unavailable the customer is told clearly that nothing was charged', async ({ page, request }) => {
    await request.post('/__test/stripe-fail', { data: { fail: true } });
    await submitCharter(page);
    await expect(page.locator('.responseDisplay h3')).toContainText("couldn't start the payment. You have not been charged");
});

test('with Stripe working the customer is sent to Stripe to pay', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe checkout</h1>' }));
    await submitCharter(page);
    await page.waitForURL('https://checkout.stripe.test/**');
    expect(page.url()).toContain('cs_test_created_1');
    expect(await h.savedBookings(request), 'nothing is booked until the payment is made').toHaveLength(0);
});

test('coming back from Stripe after paying shows the confirmation, again after a refresh, with only one booking', async ({ page, request }) => {
    const later = new Date(); later.setDate(later.getDate() + 20);
    const date = `${String(later.getDate()).padStart(2, '0')}-${String(later.getMonth() + 1).padStart(2, '0')}-${later.getFullYear()}`;
    await request.post('/__test/stripe-session', { data: { id: 'cs_test_e2e', object: 'checkout.session', payment_status: 'paid', metadata: { timeslot: '11am', firstName: 'Carol', lastName: 'Charter', email: 'carol@example.test', phone: '1', adults: '2', children: '0', date, accommodation: '', message: '', charter: 'true' } } });
    await page.goto('/success?session_id=cs_test_e2e');
    await expect(page.locator('h1')).toHaveText('Success!');
    await expect(page.locator('main')).toContainText('Carol');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Success!');
    expect(await h.savedBookings(request)).toHaveLength(1);
});

test('an unknown payment says it could not be confirmed, and gives ways to get in touch', async ({ page }) => {
    await page.goto('/success?session_id=cs_test_nope');
    await expect(page.locator('h1')).toHaveText("We couldn't confirm your booking");
    await expect(page.locator('main')).toContainText("please don't pay again");
    await expect(page.locator('main a[href^="mailto:"]')).toBeVisible();
});
