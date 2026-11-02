// The customer booking form (spec P2-8), designed for a phone first: trip cards showing the seats left,
// − and + buttons for the party, a running total, and what they typed kept if they come back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
});

const card = (page, timeslot) => page.locator('.tripCard', { has: page.locator(`input[value="${timeslot}"]`) });

test('the party can only grow to the seats left on the chosen trip, and the total follows', async ({ page, request }) => {
    const day = (() => { const d = new Date(); d.setDate(d.getDate() + 8); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    await request.post('/__test/insert-booking', { data: { date: day, adults: 9 } }); // 3 seats left at 11am
    await page.goto('/bookings');
    await h.pickDate(page, 8);
    await expect(card(page, '11am')).toContainText('3 spaces left');
    await expect(card(page, '2pm')).toContainText('12 spaces left');

    const more = (who) => page.getByRole('button', { name: `More ${who}` });
    await more('adults').click();
    await more('children').click();
    await expect(page.locator('.priceTotal')).toContainText('Total £105');
    await expect(more('adults')).toBeDisabled(); // 3 of 3 seats
    await expect(more('infants')).toBeDisabled();

    // typing more than fits says so and holds the button back
    await page.fill('#adults', '5');
    await expect(page.locator('.partyProblem')).toHaveText('Only 3 people can book this trip now (infants take a seat too).');
    await expect(page.getByRole('button', { name: 'Continue to card details' })).toBeDisabled();

    // the 2pm has room
    await card(page, '2pm').click();
    await expect(page.locator('.partyProblem')).toHaveCount(0);
    await expect(page.locator('.bookingSummary')).toContainText('2pm trip, 6 people: £225');
    await expect(page.getByRole('button', { name: 'Continue to card details' })).toBeEnabled();
});

test('a full trip can\'t be chosen; on the charter page a trip with bookings isn\'t available', async ({ page, request }) => {
    const day = (() => { const d = new Date(); d.setDate(d.getDate() + 8); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    await request.post('/__test/insert-booking', { data: { date: day, adults: 12 } });
    await page.goto('/bookings');
    await h.pickDate(page, 8);
    await expect(card(page, '11am')).toContainText('Full');
    await expect(card(page, '11am').locator('input')).toBeDisabled();
    await expect(page.locator('input[value="2pm"]')).toBeChecked();

    await page.goto('/charters');
    await h.pickDate(page, 8);
    await expect(card(page, '11am')).toContainText('Not available');
    await expect(card(page, '2pm')).toContainText('Available');
    await expect(page.locator('.priceTotal')).toContainText('for the whole boat, up to 12 people');
});

test('coming back from Stripe\'s page without saving a card, what they typed is still there', async ({ page }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await page.goto('/bookings');
    await h.pickDate(page, 9);
    await page.getByRole('button', { name: 'More adults' }).click();
    await h.fillBooking(page, { firstName: 'Bea', lastName: 'Back', email: 'bea@example.test', adults: '3' });
    await page.fill('#message', 'Celebrating a birthday');
    await page.click('button:has-text("Continue to card details")');
    await page.waitForURL('https://checkout.stripe.test/**');

    await page.goto('/canceled?kind=trip');
    await page.getByRole('link', { name: 'Return to the booking page to try again' }).click();
    await expect(page.locator('#firstName')).toHaveValue('Bea');
    await expect(page.locator('#email')).toHaveValue('bea@example.test');
    await expect(page.locator('#message')).toHaveValue('Celebrating a birthday');
    await expect(page.locator('#adults')).toHaveValue('3');
});

// Fitting the screen and 16px boxes are checked for every page in mobile.spec.js
test('on a phone: one column, and buttons big enough to tap', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/bookings');
    await expect(page.locator('.tripCard').first()).toBeVisible();
    const plus = await page.getByRole('button', { name: 'More adults' }).boundingBox();
    expect(plus.width).toBeGreaterThanOrEqual(44);
    expect(plus.height).toBeGreaterThanOrEqual(44);
    // the calendar comes first, then the trips, then the form
    const top = async (selector) => (await page.locator(selector).first().boundingBox()).y;
    expect(await top('.react-calendar')).toBeLessThan(await top('.tripCard'));
    expect(await top('.tripCard')).toBeLessThan(await top('#firstName'));
});

test('on a computer the calendar stays in view while the form scrolls past', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/bookings');
    await expect(page.locator('.tripCard').first()).toBeVisible();
    await page.locator('.continueBtn').scrollIntoViewIfNeeded();
    const calendar = await page.locator('.react-calendar').boundingBox();
    expect(calendar.y).toBeGreaterThanOrEqual(0);
    expect(calendar.y + calendar.height).toBeLessThanOrEqual(800);
});
