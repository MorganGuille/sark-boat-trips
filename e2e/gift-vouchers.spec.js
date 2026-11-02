// Gift vouchers (owner's choices, 2 Nov 2026): the Gift vouchers page, paying on Stripe's page (faked
// here), the thank-you page, and the dashboard's Vouchers tab. The rules themselves are tested in
// server/test/vouchers.test.js; these check the pages people use.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const vouchers = async (request) => (await request.get('/__test/vouchers')).json();
const fakeStripe = (page) => page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
const inAWeek = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
});

test('buying a voucher for someone else, sent on a later day: the price adds up, Stripe is paid, and the thank-you page says what happens next', async ({ page, request }) => {
    const problems = h.watch(page);
    await fakeStripe(page);
    await page.goto('/gift-vouchers');
    await expect(page.getByRole('heading', { name: 'Gift vouchers', level: 1 })).toBeVisible();
    await expect(page.locator('.giftChoice')).toContainText('£40 an adult, £25 a child'); // the dashboard prices
    await expect(page.locator('.priceTotal')).toContainText('£80'); // 2 adults to start with
    await page.getByRole('button', { name: 'More children' }).click();
    await expect(page.locator('.priceTotal')).toContainText('£105');
    await expect(page.locator('.priceTotal')).toContainText('2 adults and 1 child');

    await page.fill('#recipientName', 'Jane');
    await page.fill('#message', 'Happy birthday!');
    await page.getByText('Email it to them').click();
    await page.fill('#recipientEmail', 'jane@example.test');
    await page.getByText('On a day I choose').click();
    await page.fill('#sendOn', inAWeek());
    await page.fill('#buyerName', 'Tom Le Page');
    await page.fill('#buyerEmail', 'tom@example.test');
    await page.getByRole('button', { name: 'Continue to payment (£105)' }).click();
    await page.waitForURL('https://checkout.stripe.test/**');

    const { id, params } = await (await request.post('/__test/complete-voucher-checkout')).json();
    expect(params.line_items[0].price_data.unit_amount).toBe(10500);
    await page.goto(`/gift-vouchers/thanks?session_id=${id}`);
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    const [voucher] = await vouchers(request);
    expect([voucher.recipientName, voucher.adults, voucher.children, voucher.deliverTo, voucher.sendOn]).toEqual(['Jane', 2, 1, 'jane@example.test', inAWeek()]);
    await expect(page.locator('.voucherCode')).toHaveText(voucher.code);
    await expect(page.locator('main')).toContainText("We'll email it to jane@example.test");
    expect(problems).toEqual([]);
});

test('a charter voucher costs the charter price, and a problem on the server shows on the form', async ({ page, request }) => {
    await page.goto('/gift-vouchers');
    await expect(page.locator('.giftChoice')).toContainText('£400, the whole boat'); // the prices have arrived
    await page.locator('.giftChoice').getByText('Private charter').click();
    await expect(page.locator('.priceTotal')).toContainText('£400');
    await expect(page.locator('#adults')).toHaveCount(0);
    await page.fill('#recipientName', 'The Brehauts');
    await page.fill('#buyerName', 'Ann');
    await page.fill('#buyerEmail', 'ann@example.test');
    await request.post('/__test/stripe-fail', { data: { fail: true } });
    await page.getByRole('button', { name: /Continue to payment/ }).click();
    await expect(page.locator('.formError')).toContainText("couldn't open the payment page");
    await request.post('/__test/stripe-fail', { data: { fail: false } });
});

test('dashboard: make a voucher paid by bank transfer, use it for a booking (then hidden until Show used), then undo', async ({ page, request }) => {
    const date = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    await request.post('/__test/insert-booking', { data: { date, adults: 2, children: 1, firstName: 'Ann', lastName: 'Smith', reference: 'SBT-AAAAAA', paymentStatus: 'unpaid', prices: { adult: 4000, child: 2500, charter: 40000 } } });
    await h.logIn(page);
    await page.getByRole('tab', { name: 'Vouchers' }).click();
    await expect(page.locator('.vouchersPanel')).toContainText('No gift vouchers yet');

    await page.getByRole('button', { name: '+ Make a voucher' }).click();
    await page.fill('#voucherFor', 'Ann Smith');
    await expect(page.locator('#voucherAmount')).toHaveAttribute('placeholder', '80');
    await page.getByRole('button', { name: 'Make the voucher' }).click();
    await expect(page.locator('.notice')).toContainText(/Voucher GIFT-\w{4}-\w{2} made \(2 adults\)/);
    const row = page.locator('.vouchersTable tbody tr').first();
    await expect(row).toContainText('Not used');
    await expect(row).toContainText('Bank transfer, £80');

    await row.getByRole('button', { name: 'Use' }).click();
    await row.getByLabel('Booking reference (optional)').fill('sbt-aaaaaa');
    await row.getByRole('button', { name: 'Mark used' }).click();
    await expect(page.locator('.notice')).toContainText('covers £80. £25 still to pay');
    // used vouchers are hidden until Show used is ticked (owner, 2 Nov 2026)
    await expect(page.locator('.vouchersTable')).toHaveCount(0);
    await expect(page.locator('.vouchersPanel')).toContainText('Every voucher has been used. Tick Show used to see them.');
    await page.getByLabel('Show used (1)').check();
    await expect(row).toContainText('Used');
    await expect(row).toContainText('Booking SBT-AAAAAA');

    await row.getByRole('button', { name: 'Undo used' }).click();
    await expect(row).toContainText('Not used');
    await page.getByLabel('Show used').uncheck();
    await expect(row).toContainText('Not used'); // unused ones always show
    expect((await h.savedBookings(request))[0].voucher).toBeUndefined();
});
