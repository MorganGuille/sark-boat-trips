// The owner's dashboard, used the way the owner uses it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.reset(request);
    page.on('dialog', (dialog) => dialog.accept()); // "are you sure?" boxes
});

const addBooking = async (page, fields = {}) => {
    await page.click('role=tab[name="New booking"]');
    await page.fill('#firstName', fields.firstName ?? 'Walkup');
    await page.fill('#lastName', fields.lastName ?? 'Visitor');
    await page.fill('#email', fields.email ?? 'walkup@example.test');
    await page.fill('#adults', fields.adults ?? '2');
    await page.click('button:has-text("Confirm Booking")');
};
const notice = (page, text) => expect(page.locator('.notice')).toContainText(text);
const dismiss = async (page) => { const close = page.locator('.notice button'); if (await close.count()) await close.click(); };

test('logging in: a wrong password is refused with a message, the right one gets in, and it stays logged in on reload', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill('#username', h.USERNAME);
    await page.fill('#password', 'wrong');
    await page.click('button:has-text("Log in")');
    await expect(page.locator('.loginError')).toHaveText('Incorrect username or password');
    await page.fill('#password', h.PASSWORD);
    await page.click('button:has-text("Log in")');
    await expect(page.locator('.dashHeader')).toBeVisible();
    await page.reload();
    await expect(page.locator('.dashHeader')).toBeVisible();
    await page.click('button:has-text("Log out")');
    await expect(page.locator('#username')).toBeVisible();
    await page.reload();
    await expect(page.locator('#username')).toBeVisible();
});

test('adding a booking: it shows up, uses seats, and the customer is emailed', async ({ page, request }) => {
    await h.logIn(page);
    await addBooking(page);
    await notice(page, 'saved and confirmation email sent');
    await page.click('role=tab[name="Bookings"]');
    await expect(page.locator('tr:has-text("Walkup")')).toBeVisible();
    await expect(page.locator('.calendarDisplay')).toContainText('10 spaces available');
    expect((await h.mails(request)).some((m) => m.to === 'walkup@example.test' && m.result === 'sent')).toBe(true);
});

test('a booking can be saved with details missing', async ({ page }) => {
    await h.logIn(page);
    await page.click('role=tab[name="New booking"]');
    await page.fill('#firstName', 'Phone caller');
    await page.click('button:has-text("Confirm Booking")');
    await notice(page, 'no email address, so no confirmation was sent');
    await page.click('role=tab[name="Bookings"]');
    await expect(page.locator('tr:has-text("Phone caller")')).toBeVisible();
});

test('editing: the email-the-customer box is ticked by default, and unticking it saves the change quietly', async ({ page, request }) => {
    await h.logIn(page);
    await addBooking(page);
    await page.click('role=tab[name="Bookings"]');
    await page.locator('tr:has-text("Walkup") button:has-text("Edit")').click();
    await expect(page.locator('input[name=notifyCustomer]')).toBeChecked();
    await page.uncheck('input[name=notifyCustomer]');
    await page.fill('#phone', '0999');
    const emailsBefore = (await h.mails(request)).length;
    await page.click('button:has-text("Save changes")');
    await notice(page, 'customer not emailed, as you asked');
    expect((await h.savedBookings(request))[0].phone).toBe('0999');
    expect((await h.mails(request)).slice(emailsBefore).every((m) => m.to === 'sarkboattrips@gmail.com')).toBe(true);
});

test('editing: adding people that do not fit is refused with the reason, and the form stays open to correct it', async ({ page }) => {
    await h.logIn(page);
    await addBooking(page, { adults: '8', email: 'big@example.test', firstName: 'Big', lastName: 'Party' });
    await dismiss(page);
    await addBooking(page, { adults: '2' });
    await page.click('role=tab[name="Bookings"]');
    await page.locator('tr:has-text("Walkup") button:has-text("Edit")').click();
    await dismiss(page);
    await page.fill('#adults', '6');
    await page.click('button:has-text("Save changes")');
    await notice(page, 'only 4 spaces left'); // 12 seats, minus the 8 already booked by someone else
    await expect(page.locator('.notice.error')).toBeVisible();
    await expect(page.locator('#_id')).toBeVisible();
    await dismiss(page);
    await page.fill('#adults', '4');
    await page.click('button:has-text("Save changes")');
    await expect(page.locator('#_id')).toHaveCount(0);
    await expect(page.locator('tr:has-text("Walkup")')).toContainText('4 adults');
});

test('cancel, show cancelled, restore, cancel again, delete permanently', async ({ page, request }) => {
    await h.logIn(page);
    await addBooking(page);
    await page.click('role=tab[name="Bookings"]');
    const row = page.locator('tr:has-text("Walkup")');

    await row.locator('button:has-text("Cancel")').click();
    await notice(page, 'cancelled and email sent');
    await expect(row).toHaveCount(0);
    await expect(page.locator('.calendarDisplay')).toContainText('12 spaces available');

    await page.check('.toggle input');
    await expect(row.locator('.badgeCancelled')).toBeVisible();
    await dismiss(page);
    await row.locator('button:has-text("Restore")').click();
    await notice(page, 'restored and confirmation email sent');
    await expect(row.locator('.badgeCancelled')).toHaveCount(0);
    await expect(page.locator('.calendarDisplay')).toContainText('10 spaces available');

    await dismiss(page);
    await row.locator('button:has-text("Cancel")').click();
    await notice(page, 'cancelled');
    await expect(row.locator('.badgeCancelled')).toBeVisible();
    await dismiss(page);
    await row.locator('button:has-text("Delete permanently")').click();
    await notice(page, 'permanently deleted');
    await expect(row).toHaveCount(0);
    expect(await h.savedBookings(request)).toHaveLength(0);
});

test('notes: as many as you like, each can be deleted, and the tab shows how many', async ({ page }) => {
    await h.logIn(page);
    await page.click('role=tab[name^="Notes"]');
    for (const text of ['first note', 'second note']) {
        await page.fill('#newNote', text);
        await page.click('button:has-text("Add note")');
        await expect(page.locator('.noteList')).toContainText(text);
    }
    await expect(page.locator('.dashTab:has-text("Notes") .count')).toHaveText('2');
    await page.locator('.noteList li:has-text("first note") button').click();
    await expect(page.locator('.noteList li')).toHaveCount(1);
    await expect(page.locator('.noteList')).toContainText('second note');
});

test('season dates: an end before the start cannot be saved, a valid change is saved and confirmed', async ({ page }) => {
    await h.logIn(page);
    await expect(page.locator('#seasonStart')).not.toHaveValue(''); // wait for the saved dates to load
    const start = await page.inputValue('#seasonStart');
    await page.fill('#seasonEnd', '2000-01-01');
    await expect(page.locator('.seasonInline button[type=submit]')).toBeDisabled();
    const later = new Date(Date.now() + 250 * 86400000).toISOString().slice(0, 10);
    await page.fill('#seasonEnd', later);
    await expect(page.locator('.seasonInline button[type=submit]')).toBeEnabled();
    await page.click('.seasonInline button[type=submit]');
    await expect(page.locator('.seasonInline [role=status]')).toContainText('Saved');
    await page.reload();
    await expect(page.locator('#seasonStart')).toHaveValue(start);
    await expect(page.locator('#seasonEnd')).toHaveValue(later);
});

test('on a phone the dashboard does not scroll sideways, even with a bookings table showing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await h.logIn(page);
    await addBooking(page);
    await page.click('role=tab[name="Bookings"]');
    await expect(page.locator('.bookingsTable')).toBeVisible();
    for (const tab of ['Bookings', 'New booking', 'Availability', 'Notes']) {
        await page.click(`role=tab[name^="${tab}"]`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `the ${tab} tab is wider than the screen`).toBeLessThanOrEqual(4);
    }
});
