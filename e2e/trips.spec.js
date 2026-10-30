// Moving a trip to another time and harbour for one day (spec P2-2): the owner's dashboard box, and
// what customers then see on the booking page.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
    page.on('dialog', (dialog) => dialog.accept()); // "are you sure?" boxes
});

const notice = (page, text) => expect(page.locator('.notice')).toContainText(text);

test('the owner moves a trip to another time and harbour; the customer is emailed and the day shows it', async ({ page, request }) => {
    await h.logIn(page);
    const day = await h.pickDate(page, 5);
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '11am', firstName: 'Ann', email: 'ann@example.test' } });
    await page.reload();
    await h.pickDate(page, 5);
    await expect(page.locator('tr:has-text("Ann")')).toBeVisible();

    const box = page.locator('section.changeTrip');
    await expect(box.getByRole('combobox', { name: 'Trip', exact: true })).toContainText('11am trip (1 booking)');
    await box.getByLabel('New time').fill('12:30');
    await box.getByRole('combobox', { name: 'Leaves from' }).selectOption('maseline');
    await box.getByLabel('Note to customers (optional)').fill('The tide is too low for the Creux today.');
    await box.getByRole('button', { name: 'Save change' }).click(); // the "are you sure?" box is accepted

    await notice(page, 'now leaves at 12:30pm from the Maseline Harbour. 1 customer emailed.');
    await expect(page.locator('.tripMoved')).toContainText('The 11am trip leaves at 12:30pm from the Maseline Harbour today');
    await expect(page.locator('tr:has-text("Ann") td').first()).toHaveText('12:30pmusually 11am');
    await expect(page.locator('.calendarDisplay')).toContainText('12:30 PM (moved from 11am): 10 spaces available');
    await expect(box.getByRole('combobox', { name: 'Trip', exact: true })).toContainText('12:30pm (usually 11am) trip (1 booking)');

    const toAnn = (await h.mails(request)).filter((m) => m.to === 'ann@example.test');
    expect(toAnn).toHaveLength(1);
    expect(toAnn[0].subject).toMatch(/has moved to 12:30pm, from the Maseline Harbour$/);
    expect(toAnn[0].text).toContain('The tide is too low for the Creux today.');
});

test('a customer booking that day sees the trip\'s new time, and that it leaves from the Maseline Harbour', async ({ page }) => {
    await h.logIn(page);
    await h.pickDate(page, 6);
    const box = page.locator('section.changeTrip');
    await box.getByRole('combobox', { name: 'Trip', exact: true }).selectOption('2pm');
    await box.getByLabel('New time').fill('15:00');
    await box.getByRole('combobox', { name: 'Leaves from' }).selectOption('maseline');
    await box.getByRole('button', { name: 'Save change' }).click();
    await notice(page, 'now leaves at 3pm from the Maseline Harbour');

    await page.goto('/bookings');
    await h.pickDate(page, 6);
    await expect(page.locator('#timeslot option[value="2pm"]')).toHaveText('3pm (moved from 2pm)');
    await expect(page.locator('.calendarDisplay')).toContainText('3:00 PM (moved from 2pm): 12 spaces available');
    await expect(page.locator('.calendarDisplay')).not.toContainText('Maseline');
    await expect(page.locator('.calendarDisplay')).toContainText('11:00 AM: 12 spaces available');
    await expect(page.locator('.tripNote')).toHaveCount(0); // the 11am trip is chosen, and it hasn't moved
    await page.selectOption('#timeslot', '2pm');
    await expect(page.locator('.tripNote')).toContainText('leaves from the Maseline Harbour, not the Creux Harbour');
});
