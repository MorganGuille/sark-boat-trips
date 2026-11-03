// Moving a trip to another time and harbour for one day (spec P2-2): the owner's dashboard box, and
// what customers then see on the booking page.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
    h.acceptConfirms(page); // "are you sure?" boxes
});

const notice = (page, text) => expect(page.locator('.notice')).toContainText(text);

test('the owner moves a trip to another time and harbour; the customer is emailed and the day shows it', async ({ page, request }) => {
    await h.logIn(page);
    const day = await h.pickDate(page, 5);
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '11am', firstName: 'Ann', email: 'ann@example.test', adults: 3 } });
    await page.reload();
    await h.pickDate(page, 5);
    await expect(page.locator('tr:has-text("Ann")')).toBeVisible();

    await page.click('role=tab[name="Trip tools"]'); // the trip tools have their own tab
    const box = page.locator('section.changeTrip');
    await expect(box.getByRole('combobox', { name: 'Trip', exact: true })).toContainText('11am trip (1 booking)');
    await box.getByLabel('New time').fill('12:30');
    await box.getByRole('combobox', { name: 'Leaves from' }).selectOption('maseline');
    await box.getByLabel('Note to customers (optional)').fill('The tide is too low for the Creux today.');
    await box.getByRole('button', { name: 'Save change' }).click(); // the "are you sure?" box is accepted

    await notice(page, 'now leaves at 12:30pm from the Maseline Harbour. 1 customer emailed.');
    await page.click('role=tab[name="Bookings"]');
    await expect(page.locator('.tripMoved')).toContainText('The 11am trip leaves at 12:30pm from the Maseline Harbour today');
    // like a departures board: the new time, with the usual one crossed out underneath
    await expect(page.locator('tr:has-text("Ann") td .movedTime')).toHaveText('12:30pm');
    await expect(page.locator('tr:has-text("Ann") td s.usualTime')).toHaveText('moved from 11am');
    await expect(page.locator('.calendarDisplay .movedTime')).toHaveText('12:30 PM:');
    await expect(page.locator('.calendarDisplay s.usualTime')).toHaveText('moved from 11:00 AM');
    await expect(page.locator('.calendarDisplay')).toContainText('9 spaces available');
    // the spaces are right-aligned: "9 spaces" and "12 spaces" end at the same place
    const right = async (selector) => { const box = await page.locator(selector).boundingBox(); return Math.round(box.x + box.width); };
    expect(await right('.calendarDisplay div:nth-of-type(1) > span:last-child')).toBe(await right('.calendarDisplay div:nth-of-type(2) > span:last-child'));
    await page.click('role=tab[name="Trip tools"]');
    await expect(box.getByRole('combobox', { name: 'Trip', exact: true })).toContainText('12:30pm (usually 11am) trip (1 booking)');

    const toAnn = (await h.mails(request)).filter((m) => m.to === 'ann@example.test');
    expect(toAnn).toHaveLength(1);
    expect(toAnn[0].subject).toMatch(/has moved to 12:30pm, from the Maseline Harbour$/);
    expect(toAnn[0].text).toContain('The tide is too low for the Creux today.');
});

test('a customer booking that day sees the trip\'s new time, and that it leaves from the Maseline Harbour', async ({ page }) => {
    await h.logIn(page);
    await h.pickDate(page, 6);
    await page.click('role=tab[name="Trip tools"]'); // the trip tools have their own tab
    const box = page.locator('section.changeTrip');
    await box.getByRole('combobox', { name: 'Trip', exact: true }).selectOption('2pm');
    await box.getByLabel('New time').fill('15:00');
    await box.getByRole('combobox', { name: 'Leaves from' }).selectOption('maseline');
    await box.getByRole('button', { name: 'Save change' }).click();
    await notice(page, 'now leaves at 3pm from the Maseline Harbour');

    await page.goto('/bookings');
    await h.pickDate(page, 6);
    // the trip card shows the new time in bold, the usual one crossed out under it, and the harbour
    const card = page.locator('.tripCard', { has: page.locator('input[value="2pm"]') });
    await expect(card.locator('.movedTime')).toHaveText('3pm');
    await expect(card.locator('s.usualTime')).toHaveText('moved from 2pm');
    await expect(card).toContainText('Leaves from the Maseline Harbour');
    await expect(card).toContainText('12 spaces left');
    const usual = page.locator('.tripCard', { has: page.locator('input[value="11am"]') });
    await expect(usual).not.toContainText('Maseline');
    // the moved time lines up with the other trip's time, and its crossed-out time sits under it on the left
    const left = async (locator) => Math.round((await locator.boundingBox()).x);
    expect(await left(card.locator('.movedTime'))).toBe(await left(usual.locator('.tripCardTime strong')));
    expect(await left(card.locator('s.usualTime'))).toBe(await left(usual.locator('.tripCardTime strong')));
    await card.click();
    await expect(page.locator('.bookingSummary')).toContainText('3pm trip');
});

test('the owner messages everyone on a trip from the dashboard', async ({ page, request }) => {
    await h.logIn(page);
    const day = await h.pickDate(page, 5);
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '2pm', firstName: 'Ann', email: 'ann@example.test' } });
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '2pm', firstName: 'Bob', email: 'bob@example.test' } });
    await page.reload();
    await h.pickDate(page, 5);

    await page.click('role=tab[name="Trip tools"]'); // the trip tools have their own tab
    const box = page.locator('section.messageTrip');
    await expect(box.getByRole('button', { name: 'Nobody booked on this trip' })).toBeDisabled(); // the 11am trip is empty
    await box.getByRole('combobox', { name: 'Trip' }).selectOption('2pm');
    await expect(box.getByRole('button', { name: 'Send to 2pm trip' })).toBeDisabled(); // no message yet
    await box.getByRole('textbox', { name: 'Message' }).fill("It's choppy today, please bring a warm jacket.");
    await box.getByRole('button', { name: 'Send to 2pm trip' }).click(); // the "are you sure?" box is accepted

    await notice(page, 'Message sent to 2 customers on the 2pm trip on');
    await expect(box.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    const sent = (await h.mails(request)).filter((m) => /^A message about your boat trip/.test(m.subject));
    expect(sent.map((m) => m.to).sort()).toEqual(['ann@example.test', 'bob@example.test']);
    expect(sent[0].text).toContain("It's choppy today, please bring a warm jacket.");
});
