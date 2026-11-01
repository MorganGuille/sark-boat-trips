// The public booking page, as a customer sees it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => { await h.asNewVisitor(page); await h.reset(request); });

test('the page loads with the calendar and seat counts, and nothing is blocked or broken', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/bookings');
    await expect(page.locator('.react-calendar')).toBeVisible();
    await h.pickDate(page, 8); // a day ahead: today's trips close for booking an hour before they leave
    await expect(page.locator('.tripCard').first()).toContainText('12 spaces left');
    // the prices come from the owner's settings, not from the page
    const prices = page.getByRole('list', { name: 'Prices' });
    await expect(prices).toContainText('Adults £40');
    await expect(prices).toContainText('Children (4 to 14) £25');
    await expect(prices).toContainText('Infants (3 and under) free');
    await expect(page.locator('.priceTotal')).toContainText('Total £40'); // 1 adult to start with
    expect(problems).toEqual([]);
});

test('a customer saves a card on Stripe\'s page, comes back to a confirmation, and both sides are emailed', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    const email = await h.fillBooking(page, { firstName: 'Alice', email: 'alice@example.test', adults: '2' });
    await expect(page.locator('.cardNotice')).toContainText('Nothing is charged now');
    await expect(page.locator('.cardNotice')).toContainText('cancel free of charge up to 24 hours before');
    await expect(page.locator('.cardNotice a')).toHaveAttribute('href', '/terms');
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
    await expect(page.locator('main')).toContainText('Use the Manage your booking button in your confirmation email, up to 24 hours before');

    const saved = await h.savedBookings(request);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ date, firstName: 'Alice', adults: 2, timeslot: '11am', status: 'active', paymentStatus: 'card_saved' });
    const sent = (await h.mails(request)).filter((m) => m.result === 'sent').map((m) => m.to).sort();
    expect(sent).toEqual([email, 'owner@sarkboattrips.test'].sort());

    await page.reload();
    await expect(page.locator('h1')).toHaveText('Success!');
    expect(await h.savedBookings(request), 'a refresh makes no second booking').toHaveLength(1);
});

test('a parent with a toddler: the infant box is free, takes a seat, and shows on the dashboard', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await page.goto('/bookings');
    await expect(page.locator('label[for="infants"]')).toHaveText('Infants3 and under, free');
    await expect(page.locator('label[for="children"]')).toHaveText('Children4 to 14');
    await h.pickDate(page, 9);
    await h.fillBooking(page, { firstName: 'Parent', adults: '1' });
    await page.getByRole('button', { name: 'More infants' }).click();
    await expect(page.locator('.priceTotal')).toContainText('1 adult × £40 + 1 infant free');
    await page.click('button:has-text("Continue to card details")');
    await page.waitForURL('https://checkout.stripe.test/**');
    const { id } = await (await request.post('/__test/complete-checkout')).json();
    await page.goto(`/success?session_id=${id}`);
    await expect(page.locator('main')).toContainText('£40 will be charged', { timeout: 15000 });
    expect((await h.savedBookings(request))[0]).toMatchObject({ adults: 1, children: 0, infants: 1 });

    // on the dashboard (which opens on today, so find the booking by name)
    await h.logIn(page);
    await page.fill('#bookingSearch', 'Smith');
    await page.click('form[role=search] button[type=submit]');
    await expect(page.locator('.byDayRow:has-text("Parent")')).toContainText('1 adult, 1 infant');
});

test('a booking the server refuses shows the reason and keeps what the customer typed', async ({ page, request }) => {
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    await expect(page.locator('.tripCard').first()).toContainText('12 spaces left'); // the page has the seats as they were
    await request.post('/__test/insert-booking', { data: { date, adults: 12 } }); // someone else fills the 11am trip meanwhile
    await h.fillBooking(page, { firstName: 'Latecomer', email: 'late@example.test', adults: '2' });
    await page.click('button:has-text("Continue to card details")');
    await expect(page.locator('.formError')).toContainText('is full. Please choose another trip.');
    await expect(page.locator('#firstName')).toHaveValue('Latecomer');
    // the cards are reloaded: the 11am now shows Full, and the 2pm is chosen instead
    await expect(page.locator('.tripCard', { has: page.locator('input[value="11am"]') })).toContainText('Full');
    await expect(page.locator('input[value="2pm"]')).toBeChecked();
    expect(await h.savedBookings(request)).toHaveLength(1);
});

test('the terms have their own page (Stripe links to it) with the payment and cancellation rules', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/terms');
    const terms = page.locator('main');
    await expect(terms.locator('h2')).toHaveText('Terms and Conditions - Sark Boat Trips');
    await expect(terms).toContainText('Nothing is charged when you book.');
    await expect(terms).toContainText('cancel at least 24 hours before your trip starts');
    await expect(terms).toContainText('Private charters: cancel at least 48 hours before');
    await expect(terms).toContainText('If we cancel, you won\'t be charged');
    await expect(terms).toContainText('infants (3 and under) go free');
    await expect(terms).not.toContainText('deposit');
    expect(problems).toEqual([]);
});

test('the privacy policy has its own page (Stripe links to it) and explains the saved card', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/privacy');
    const policy = page.locator('main');
    await expect(policy.locator('h2')).toHaveText('Privacy Policy for Sark Boat Trips');
    await expect(policy).toContainText('your card is saved and later charged by Stripe');
    await expect(policy).toContainText('We never see or store your full card number');
    await expect(policy).toContainText('until you ask us to remove them');
    await expect(policy).not.toContainText('**');
    await expect(policy).not.toContainText('For charter bookings');
    expect(problems).toEqual([]);
    await page.goto('/terms');
    await expect(page.locator('main a[href="/privacy"]')).toHaveText('privacy policy');
});

test('the booking page tells customers how cancelling works', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page.locator('.bookingsSmall')).toContainText('Free cancellation up to 24 hours before.');
    await page.goto('/charters');
    await expect(page.locator('.bookingsSmall')).toContainText('Free cancellation up to 48 hours before.');
    await expect(page.locator('.charterFacts')).toContainText('up to 48 hours before');
    await expect(page.locator('.goodToKnow')).toContainText('Free cancellation up to 48 hours before');
    await expect(page.locator('.cardNotice')).toContainText('up to 48 hours before');
    // written differently, it is still the charter page (it used to show the trip booking form)
    await page.goto('/Charters/');
    await expect(page.locator('.bookingsSmall')).toContainText('Free cancellation up to 48 hours before.');
    await expect(page.locator('.cardNotice')).toContainText('up to 48 hours before');
});

test('closing Stripe\'s page leads to a page saying nothing was booked or charged', async ({ page }) => {
    await page.goto('/canceled');
    await expect(page.locator('main')).toContainText('nothing has been booked');
    await expect(page.locator('main')).toContainText('nothing has been charged');
    // Try again goes back to the booking page (trips are the default), and there is a way home
    await expect(page.getByRole('link', { name: 'Return to the booking page to try again' })).toHaveAttribute('href', '/bookings');
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/canceled?kind=charter');
    await expect(page.getByRole('link', { name: 'Return to the charters page to try again' })).toHaveAttribute('href', '/charters');
    await page.goto('/canceled?kind=trip');
    await page.getByRole('link', { name: 'Return to the booking page to try again' }).click();
    await expect(page).toHaveURL(/\/bookings$/);
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
