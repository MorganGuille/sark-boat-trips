// The owner's dashboard, used the way the owner uses it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page); // the calendar is loaded a lot, and its requests are rate limited per visitor
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
// The season dates and prices are locked until the Edit button in the top bar is pressed
const editSettings = (page) => page.getByRole('button', { name: /Edit season dates and prices/ }).click();
const saveButton = (page, field) => page.locator(`form:has(${field}) button[type=submit]`);
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

test('dates: stored as YYYY-MM-DD, shown day-month-year, and the edit form uses a date picker', async ({ page, request }) => {
    await h.logIn(page);
    const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, british: `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}` }; };
    const today = day(0);
    const later = day(3);

    await addBooking(page);
    await notice(page, `on ${today.british} at 11am saved`);
    expect((await h.savedBookings(request))[0].date).toBe(today.iso);

    await page.click('role=tab[name="Bookings"]');
    await page.locator('tr:has-text("Walkup") button:has-text("Edit")').click();
    await expect(page.locator('#date')).toHaveAttribute('type', 'date');
    await expect(page.locator('#date')).toHaveValue(today.iso);
    await page.fill('#date', later.iso);
    await page.click('button:has-text("Save changes")');
    await notice(page, `on ${later.british} updated successfully`);
    expect((await h.savedBookings(request))[0].date).toBe(later.iso);
});

test('season dates and prices are locked until Edit is pressed, and Done locks them again', async ({ page }) => {
    await h.logIn(page);
    await expect(page.locator('#seasonStart')).not.toHaveValue('');
    const fields = ['#seasonStart', '#seasonEnd', '#priceAdult', '#priceChild', '#priceCharter'];

    // locked: the values show, but nothing can be typed and there is no Save button
    for (const field of fields) await expect(page.locator(field)).toBeDisabled();
    await expect(page.locator('#priceAdult')).toHaveValue('40');
    await expect(page.locator('form:has(#seasonStart) button[type=submit], form:has(#priceAdult) button[type=submit]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit season dates and prices/ })).toHaveText('Edit');

    await editSettings(page);
    for (const field of fields) await expect(page.locator(field)).toBeEnabled();
    await expect(page.locator('form:has(#seasonStart) button[type=submit], form:has(#priceAdult) button[type=submit]')).toHaveCount(2);

    // Done drops what was typed but not saved, and locks everything again
    await page.fill('#priceAdult', '99');
    await page.getByRole('button', { name: /Done editing season dates and prices/ }).click();
    for (const field of fields) await expect(page.locator(field)).toBeDisabled();
    await expect(page.locator('#priceAdult')).toHaveValue('40');
});

test('prices: set in the top row, shown to customers on the booking page', async ({ page, request, browser }) => {
    await h.logIn(page);
    await expect(page.locator('#priceAdult')).toHaveValue('40');
    await expect(page.locator('#priceChild')).toHaveValue('25');
    await expect(page.locator('#priceCharter')).toHaveValue('400');
    await editSettings(page);
    await expect(saveButton(page, '#priceAdult')).toBeDisabled(); // nothing changed yet

    await page.fill('#priceAdult', '45');
    await page.fill('#priceChild', '27.5');
    await page.fill('#priceCharter', '450');
    await saveButton(page, '#priceAdult').click();
    await expect(page.locator('.seasonSaved')).toContainText('adult £45, child £27.50, charter £450');

    const customer = await browser.newPage();
    await customer.goto('/bookings');
    const prices = customer.getByRole('list', { name: 'Prices' });
    await expect(prices).toContainText('Adults £45');
    await expect(prices).toContainText('Children (4 to 14) £27.50');
    await customer.goto('/charters');
    await expect(customer.getByRole('list', { name: 'Prices' })).toContainText('£450 for the whole boat');
    await customer.close();

    // the browser itself refuses a negative price, so it is never sent
    await page.fill('#priceAdult', '-5');
    expect(await page.locator('#priceAdult').evaluate((input) => input.validity.valid)).toBe(false);
});

test('report: the month\'s totals show on screen and download as a CSV file', async ({ page }) => {
    await h.logIn(page);
    await addBooking(page, { firstName: 'One', adults: '2' });
    await dismiss(page);
    await addBooking(page, { firstName: 'Two', adults: '3' });
    await page.click('role=tab[name="Report"]');
    const total = page.locator('.reportStats');
    await expect(total.locator('div', { hasText: 'Adults' })).toContainText('5');
    await expect(total.locator('div', { hasText: 'Income' })).toContainText('£200'); // 5 adults at £40

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download CSV")')]);
    expect(download.suggestedFilename()).toMatch(/^sark-boat-trips-\d{4}-\d{2}\.csv$/);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const lines = Buffer.concat(chunks).toString('utf8').trim().split(/\r?\n/);
    const d = new Date();
    const today = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    expect(lines).toEqual([
        'Date,Adults,Children,Infants,Passengers,Charters,Income (GBP)',
        `${today},5,0,0,5,0,200.00`,
        'Total,5,0,0,5,0,200.00',
    ]);
});

test('payment: a new booking shows as unpaid with what is owed, can be marked paid, and the mark can be undone', async ({ page, request }) => {
    await h.logIn(page);
    await addBooking(page, { adults: '2' });
    await dismiss(page);
    await page.click('role=tab[name="Bookings"]');
    const row = page.locator('tr:has-text("Walkup")');
    await expect(row.locator('.payBadge')).toHaveText('Unpaid');
    await expect(row.locator('.payAmount')).toHaveText('£80');

    await row.locator('button:has-text("Mark paid")').click(); // the "are you sure?" box is accepted
    await notice(page, 'marked as paid in person (£80)');
    await expect(row.locator('.payBadge')).toHaveText('Paid in person');
    await expect(row.locator('button:has-text("Mark paid")')).toHaveCount(0);
    expect((await h.savedBookings(request))[0]).toMatchObject({ paymentStatus: 'paid_in_person', amountPaid: 8000 });

    await dismiss(page);
    await row.locator('button:has-text("Undo paid")').click();
    await notice(page, 'marked as unpaid again');
    await expect(row.locator('.payBadge')).toHaveText('Unpaid');
    expect((await h.savedBookings(request))[0].paymentStatus).toBe('unpaid');
});

// 'YYYY-MM-DD' n days from today, and how the calendar labels that day
const dayAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const calendarLabel = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };

test('upcoming bookings: the next 7 days grouped by day with totals, further ahead on request, and Open day shows that day', async ({ page, request }) => {
    const insert = (n, fields) => request.post('/__test/insert-booking', { data: { date: dayAhead(n), timeslot: '11am', email: 'x@example.test', adults: 2, ...fields } });
    await insert(2, { firstName: 'Ann', lastName: 'Smith', children: 1 });
    await insert(2, { firstName: 'Bob', lastName: 'Jones', timeslot: '2pm' });
    await insert(5, { firstName: 'Cara', lastName: 'Le Page' });
    await insert(10, { firstName: 'Dan', lastName: 'Mauger' });
    await h.logIn(page);
    await page.getByRole('button', { name: 'Upcoming', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Upcoming bookings' })).toBeVisible();
    await expect(page.locator('#upcomingDays')).toHaveValue('7'); // the owner's choice: a week ahead to start with

    const groups = page.locator('.byDayGroup');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).locator('.byDayHead')).toContainText('2 bookings · 5 guests');
    await expect(groups.nth(0).locator('.byDayRow').nth(0)).toContainText('Ann Smith');
    await expect(groups.nth(0).locator('.byDayRow').nth(1)).toContainText('2pm');
    await expect(page.locator('.byDayRow', { hasText: 'Dan Mauger' })).toHaveCount(0); // 10 days ahead

    await page.locator('#upcomingDays').selectOption('14');
    await expect(groups).toHaveCount(3);
    await expect(page.locator('.byDayRow', { hasText: 'Dan Mauger' })).toBeVisible();

    // Open day: that day's table, with its buttons, and the calendar moves to it
    await groups.nth(1).getByRole('button', { name: /^Open day/ }).click();
    await expect(page.locator('tr:has-text("Cara Le Page")').getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.react-calendar__tile--active abbr')).toHaveAttribute('aria-label', calendarLabel(5));
});

test('search finds a booking by email or phone, and lists a range of dates', async ({ page, request }) => {
    const insert = (n, fields) => request.post('/__test/insert-booking', { data: { date: dayAhead(n), timeslot: '11am', adults: 2, ...fields } });
    await insert(3, { firstName: 'Ann', lastName: 'Smith', email: 'ann.smith@example.test', phone: '+44 7700 900123' });
    await insert(8, { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.test', phone: '01481 832000' });
    await h.logIn(page);
    const search = async (text) => {
        await page.fill('#bookingSearch', text);
        await page.getByRole('button', { name: 'Search', exact: true }).click();
    };

    await search('07700 900123'); // typed the British way, saved with +44
    await expect(page.getByRole('heading', { name: 'Results for “07700 900123”' })).toBeVisible();
    await expect(page.locator('.byDayRow')).toHaveCount(1);
    await expect(page.locator('.byDayRow')).toContainText('Ann Smith');

    await search('bob@');
    await expect(page.locator('.byDayRow')).toHaveCount(1);
    await expect(page.locator('.byDayRow')).toContainText('Bob Jones');

    // nothing typed, just dates: everything in between
    await page.fill('#bookingSearch', '');
    await page.fill('#searchFrom', dayAhead(1));
    await page.fill('#searchTo', dayAhead(5));
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bookings by date' })).toBeVisible();
    await expect(page.locator('.byDayRow')).toHaveCount(1);
    await expect(page.locator('.byDayRow')).toContainText('Ann Smith');

    await page.getByRole('button', { name: 'Back to day' }).click();
    await expect(page.locator('#searchFrom')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the trip tools have their own tab, so the Bookings tab is just the bookings', async ({ page }) => {
    await h.logIn(page);
    await addBooking(page, { firstName: 'Ann', email: '' });
    await page.click('role=tab[name="Bookings"]');
    await expect(page.locator('tr:has-text("Ann")')).toBeVisible();
    const tools = ['Change trip details', 'Message everyone on a trip', 'Cancel a whole trip'];
    for (const name of tools) await expect(page.getByRole('heading', { name })).toHaveCount(0);

    await page.click('role=tab[name="Trip tools"]');
    for (const name of tools) await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.locator('#cancelTripTime')).toContainText('11am trip (1 booking)'); // the day's bookings, as on the Bookings tab

    // a search replaces the day's bookings, so the tools wait until it is cleared
    await page.click('role=tab[name="Bookings"]');
    await page.fill('#bookingSearch', 'Visitor');
    await page.click('form[role=search] button[type=submit]');
    await page.click('role=tab[name="Trip tools"]');
    await expect(page.getByRole('heading', { name: 'Cancel a whole trip' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to the day' }).click();
    await expect(page.locator('#cancelTripTime')).toContainText('11am trip (1 booking)');
});

test('cancel a whole trip: one button cancels every booking on it, emails them, and closes the trip', async ({ page, request }) => {
    await h.logIn(page);
    await addBooking(page, { firstName: 'Ann', email: 'ann@example.test', adults: '2' });
    await dismiss(page);
    await addBooking(page, { firstName: 'Bob', email: 'bob@example.test', adults: '3' });
    await dismiss(page);
    await page.click('role=tab[name="Trip tools"]'); // the trip tools have their own tab
    await expect(page.locator('#cancelTripTime')).toContainText('11am trip (2 bookings)');
    await page.click('button:has-text("Cancel 11am trip")'); // the "are you sure?" box is accepted
    await notice(page, 'is cancelled and closed to new bookings: 2 bookings cancelled, 2 customers emailed. Nobody will be charged.');
    await page.click('role=tab[name="Bookings"]');
    await expect(page.locator('tr:has-text("Ann")')).toHaveCount(0);
    await expect(page.locator('.calendarDisplay')).toContainText('11:00 AM: 0 spaces available');
    const saved = await h.savedBookings(request);
    expect(saved.map((b) => b.status)).toEqual(['cancelled', 'cancelled']);
    const sent = (await h.mails(request)).filter((m) => m.result === 'sent' && /cancelled/i.test(m.subject)).map((m) => m.to).sort();
    expect(sent).toEqual(['ann@example.test', 'bob@example.test', 'owner@sarkboattrips.test']);
});

test('the owner can book outside the season, even when the address is typed /Dashboard/ (an Android phone did)', async ({ page, request }) => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    await request.post('/__test/season', { data: { start: day(20), end: day(40) } }); // today is before the season
    await h.logIn(page);
    await page.goto('/Dashboard/');
    await expect(page.locator('.react-calendar')).toBeVisible();
    await expect(page.locator('#seasonStart')).toHaveValue(day(20)); // the season has loaded, so the calendar knows it
    await expect(page.locator('.react-calendar__tile.available').first()).toBeVisible(); // and so has the month
    expect(await page.locator('.react-calendar__tile:disabled').count(), 'no day is greyed out on the dashboard').toBe(0);
    await addBooking(page, { firstName: 'Offseason', email: '' });
    await notice(page, 'saved');
    expect((await h.savedBookings(request)).some((b) => b.firstName === 'Offseason')).toBe(true);
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
    expect((await h.mails(request)).slice(emailsBefore).every((m) => m.to === 'owner@sarkboattrips.test')).toBe(true);
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
    await editSettings(page);
    const start = await page.inputValue('#seasonStart');
    await page.fill('#seasonEnd', '2000-01-01');
    await expect(page.locator('form:has(#seasonStart) button[type=submit]')).toBeDisabled();
    const later = new Date(Date.now() + 250 * 86400000).toISOString().slice(0, 10);
    await page.fill('#seasonEnd', later);
    await expect(page.locator('form:has(#seasonStart) button[type=submit]')).toBeEnabled();
    await page.click('form:has(#seasonStart) button[type=submit]');
    await expect(page.locator('form:has(#seasonStart) [role=status]')).toContainText('Saved');
    await page.reload();
    await expect(page.locator('#seasonStart')).toHaveValue(start);
    await expect(page.locator('#seasonEnd')).toHaveValue(later);
});

test('customer data: searching an email shows everything held for it, downloads it, and erases it once confirmed', async ({ page, request }) => {
    const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await request.post('/__test/insert-booking', { data: { date: lastMonth, firstName: 'Ann', lastName: 'Le Page', email: 'ann@example.test', phone: '07700 900123', adults: 2, reference: 'SBT-ANNANN', paymentStatus: 'paid', amountPaid: 8000 } });
    await h.logIn(page);
    await page.fill('#bookingSearch', 'Ann@Example.test');
    await page.click('form[role=search] button[type=submit]');
    await page.getByRole('button', { name: 'Customer data for ann@example.test' }).click();
    const panel = page.locator('.customerDataBody');
    await expect(panel).toContainText('Bookings (1)');
    await expect(panel).toContainText('Ann Le Page · 2 adults · SBT-ANNANN');
    await expect(panel).toContainText('Paid online · 07700 900123');

    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download their data' }).click();
    expect((await download).suggestedFilename()).toBe('sark-boat-trips-ann@example.test.json');

    await panel.getByRole('button', { name: 'Erase' }).click();
    const erase = panel.getByRole('button', { name: 'Erase for good' });
    await expect(erase).toBeDisabled(); // until the address is typed again
    await page.fill('#eraseConfirm', 'ann@example.test');
    await erase.click();
    await notice(page, 'Erased ann@example.test from 1 booking. Dates, party sizes and amounts are kept for your reports.');
    await expect(panel).toContainText('Nothing is held for ann@example.test.');
    const [saved] = await h.savedBookings(request);
    expect([saved.firstName, saved.email, saved.phone, saved.adults, saved.amountPaid]).toEqual(['Erased', '', '', 2, 8000]);
});
