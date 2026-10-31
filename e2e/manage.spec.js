// Manage my booking (spec P2-6): the customer opens the link from their email, changes the number of
// people, sends a message and cancels. After the deadline the page only shows how to get in touch.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
    page.on('dialog', (dialog) => dialog.accept()); // "are you sure?" boxes
});

const dayFromNow = (days) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
};

// A booking as the server makes them, with the code from its link
const insert = async (request, fields = {}) => {
    const code = `${'a'.repeat(26)}${Math.random().toString(36).slice(2, 8).padEnd(6, 'b')}`;
    await request.post('/__test/insert-booking', {
        data: {
            date: dayFromNow(6), firstName: 'Ann', lastName: 'Smith', email: 'ann@example.test', adults: 2, children: 0, paymentStatus: 'card_saved',
            cardLabel: 'Visa •••• 4242 (expires 08/28)', prices: { adult: 4000, child: 2500, charter: 40000 }, manageToken: code, reference: 'SBT-ABC234', ...fields,
        },
    });
    return code;
};

const notice = (page) => page.locator('.manageNotice');

test('the customer changes the number of people, sends a message, then cancels', async ({ page, request }) => {
    const problems = h.watch(page);
    const code = await insert(request);
    await page.goto(`/manage/${code}`);
    await expect(page.getByRole('heading', { name: 'Hello Ann' })).toBeVisible();
    const details = page.locator('.manageDetails');
    await expect(details).toContainText('Time11am');
    await expect(details).toContainText('Party2 adults');
    await expect(details).toContainText('£80, charged to your saved card (Visa •••• 4242 (expires 08/28)) when your trip starts');
    await expect(details).toContainText('Booking referenceSBT-ABC234');
    await expect(page.locator('.manageDeadline')).toContainText('free of charge until 11am on');

    // one more child: the new price shows before saving
    await page.getByLabel('Children').fill('1');
    await expect(page.locator('#partyTitle ~ p.muted')).toContainText('New price: £105 (was £80)');
    await page.getByRole('button', { name: 'Save the new numbers' }).click();
    await expect(notice(page)).toHaveText("Your booking is now for 2 adults and 1 child. We've emailed you the details.");
    await expect(details).toContainText('Party2 adults and 1 child');
    await expect(page.getByRole('button', { name: 'Save the new numbers' })).toBeDisabled(); // nothing new to save

    await page.getByLabel('Your message').fill('Could we move to the 2pm?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(notice(page)).toContainText('your message has been sent');
    await expect(page.getByLabel('Your message')).toHaveValue('');

    await page.getByRole('button', { name: 'Cancel my booking' }).click();
    await expect(notice(page)).toContainText("Your booking has been cancelled and your card won't be charged.");
    await expect(page.getByRole('heading', { name: 'Your cancelled booking' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel my booking' })).toHaveCount(0);
    await expect(details).toContainText('Nothing will be charged');

    const subjects = (await h.mails(request)).map((m) => m.subject);
    expect(subjects.some((s) => /^Party changed by customer: Ann Smith, now 3 people/.test(s))).toBe(true);
    expect(subjects.some((s) => /^Message from Ann Smith/.test(s))).toBe(true);
    expect(subjects.some((s) => /^Cancelled by customer: Ann Smith/.test(s))).toBe(true);
    expect(problems).toEqual([]);
});

test('adding more people than there are seats is refused with how many fit', async ({ page, request }) => {
    await request.post('/__test/insert-booking', { data: { date: dayFromNow(6), adults: 9 } });
    const code = await insert(request, { adults: 2 }); // 1 seat left
    await page.goto(`/manage/${code}`);
    await expect(page.locator('#partyTitle ~ p.muted')).toContainText('Up to 3 people can come on this trip');
    await page.getByLabel('Adults').fill('5');
    await page.getByRole('button', { name: 'Save the new numbers' }).click();
    await expect(notice(page)).toContainText("Sorry, there's only room for 3 people on this trip now");
    await expect(page.locator('.manageDetails')).toContainText('Party2 adults');
});

test('after the deadline the page shows how to get in touch, and messages still work', async ({ page, request }) => {
    const code = await insert(request, { date: dayFromNow(1), charter: 'true' }); // a charter tomorrow: inside its 48 hours
    await page.goto(`/manage/${code}`);
    await expect(page.getByRole('heading', { name: 'Your private charter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Need to change something?' })).toBeVisible();
    await expect(page.locator('main')).toContainText('It is too late to change or cancel this booking online.');
    await expect(page.locator('main')).toContainText('later than 48 hours before');
    await expect(page.locator('main')).toContainText('info@sarkboattrips.com');
    await expect(page.getByRole('button', { name: 'Cancel my booking' })).toHaveCount(0);
    await expect(page.getByLabel('Adults')).toHaveCount(0);
    await page.getByLabel('Your message').fill('Running 10 minutes late, sorry!');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(notice(page)).toContainText('your message has been sent');
});

test('a wrong link says so and shows how to get in touch', async ({ page }) => {
    await page.goto('/manage/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    await expect(page.getByRole('alert')).toHaveText("We couldn't find that booking. Please check the link in your email, or contact us.");
    await expect(page.locator('main')).toContainText('info@sarkboattrips.com');
});

test('on a phone the page fits the screen and search engines are told not to list it', async ({ page, request }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const code = await insert(request);
    await page.goto(`/manage/${code}`);
    await expect(page.getByRole('heading', { name: 'Hello Ann' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('the owner sees the reference under the name and can search for it', async ({ page, request }) => {
    await insert(request, { lastName: 'Jones' });
    await h.logIn(page);
    await page.fill('#lastNameSearch', 'sbt-abc234');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('tr:has-text("Ann Jones") .bookingRef')).toHaveText('SBT-ABC234');
});
