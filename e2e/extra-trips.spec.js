// Extra trips (spec P2-2 step 3): the owner adds a swim trip to a day on the dashboard, customers see
// it on the calendar and the booking form with its own price and note, and the owner can delete it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
    page.on('dialog', (dialog) => dialog.accept()); // "are you sure?" boxes
});

const notice = (page, text) => expect(page.locator('.notice')).toContainText(text);

const tab = (page, name) => page.getByRole('tab', { name }).click();

// Opens the Extra trips tab and adds the swim trip to the chosen day
const addSwimTrip = async (page) => {
    await tab(page, 'Extra trips');
    const box = page.locator('section.addTrip');
    await expect(box.getByText('No extra trips on this day.')).toBeVisible();
    await expect(box.getByLabel('Adult price (£)')).toHaveValue('40'); // starts from the normal prices
    await expect(box.getByLabel('Child price (£)')).toHaveValue('25');
    await box.getByLabel('Name').fill('Swim trip');
    await box.getByLabel('Time').fill('16:30');
    await box.getByLabel('Length (hours)').fill('1.5');
    await expect(box.getByLabel('Seats')).toHaveAttribute('max', '12'); // the boat's legal limit
    await box.getByLabel('Seats').fill('8');
    await box.getByLabel('Adult price (£)').fill('45');
    await box.getByLabel('Child price (£)').fill('30');
    await box.getByLabel('Note to customers (optional)').fill('Bring swimwear and a towel.');
    await box.getByRole('button', { name: 'Add extra trip' }).click(); // the "are you sure?" box is accepted
    await notice(page, 'Swim trip added on');
    return box;
};

test('the owner adds a swim trip; it shows on the dashboard and calendar with its own seats', async ({ page, request }) => {
    await h.logIn(page);
    const day = await h.pickDate(page, 5);
    const box = await addSwimTrip(page);
    await notice(page, 'at 4:30pm from the Creux Harbour: 8 seats, 1.5 hours, £45 adults, £30 children. Customers can book it now.');
    await expect(box.locator('.extraTrips li')).toContainText('Swim trip (4:30pm): 8 seats, 1.5 hours, £45 adults, £30 children, 0 bookings');

    const row = page.locator('.calendarDisplay div', { hasText: 'Swim trip' });
    await expect(row.locator('.tripTime')).toHaveText('4:30 PM:Swim trip');
    await expect(row).toContainText('8 spaces available');
    // still lined up with the usual trips
    const left = async (locator) => Math.round((await locator.boundingBox()).x);
    expect(await left(row.locator('.tripTime'))).toBe(await left(page.locator('.calendarDisplay div:nth-of-type(1) > span:first-child')));

    // a booking on it shows in the day's table with the trip's name, after the 2pm bookings
    const timeslot = (await (await request.get(`/bookings/trips/${day}`)).json()).data.find((t) => t.extra).timeslot;
    await request.post('/__test/insert-booking', { data: { date: day, timeslot, firstName: 'Sam' } });
    await request.post('/__test/insert-booking', { data: { date: day, timeslot: '2pm', firstName: 'Bob' } });
    await page.reload();
    await h.pickDate(page, 5);
    await expect(page.locator('tr:has-text("Sam") td').nth(0)).toHaveText('4:30pmSwim trip');
    await expect(page.locator('tbody tr').last()).toContainText('Sam');
    await expect(row).toContainText('6 spaces available');
});

test('a customer sees the swim trip with its price and note; the charter page leaves it out', async ({ page }) => {
    await h.logIn(page);
    await h.pickDate(page, 6);
    await addSwimTrip(page);

    await page.goto('/bookings');
    await h.pickDate(page, 6);
    const card = page.locator('.tripCard', { hasText: 'Swim trip' });
    await expect(card).toContainText('4:30pm');
    await expect(card).toContainText('8 spaces left');
    await expect(card).toContainText('£45 adults, £30 children, about 1.5 hours');
    await expect(page.locator('.extraTripNote')).toHaveCount(0); // the 11am trip is chosen
    await card.click();
    await expect(page.locator('.extraTripNote')).toHaveText('Swim trip: Bring swimwear and a towel.');
    // its own prices add up
    await page.getByRole('button', { name: 'More adults' }).click();
    await page.getByRole('button', { name: 'More children' }).click();
    await expect(page.locator('.priceTotal')).toContainText('Total £120');
    await expect(page.locator('.priceTotal')).toContainText('2 adults × £45 + 1 child × £30');

    await page.goto('/charters');
    await h.pickDate(page, 6);
    await expect(page.locator('.tripCard')).toHaveCount(2);
    await expect(page.locator('.tripCards')).not.toContainText('Swim trip');
});

test('the owner deletes an extra trip; it is refused while someone is booked on it', async ({ page, request }) => {
    await h.logIn(page);
    const day = await h.pickDate(page, 7);
    const box = await addSwimTrip(page);
    const timeslot = (await (await request.get(`/bookings/trips/${day}`)).json()).data.find((t) => t.extra).timeslot;
    await request.post('/__test/insert-booking', { data: { date: day, timeslot, firstName: 'Sam' } });
    await page.reload();
    await h.pickDate(page, 7);

    await tab(page, 'Extra trips');
    await expect(box.locator('.extraTrips li')).toContainText('1 booking');
    await box.getByRole('button', { name: 'Delete Swim trip (4:30pm)' }).click();
    await notice(page, 'has 1 booking. Cancel the trip first');

    await tab(page, 'Trip tools');
    await page.locator('#cancelTripTime').selectOption(timeslot);
    await page.getByRole('button', { name: 'Cancel Swim trip (4:30pm)' }).click();
    await notice(page, 'The Swim trip (4:30pm) on');
    await tab(page, 'Extra trips');
    await box.getByRole('button', { name: 'Delete Swim trip (4:30pm)' }).click();
    await notice(page, 'deleted. Customers can no longer see it.');
    await expect(box.getByText('No extra trips on this day.')).toBeVisible();
    await expect(page.locator('.calendarDisplay')).not.toContainText('Swim trip');
});

test('the owner edits an extra trip: fixes its name, adds seats and changes its price', async ({ page }) => {
    await h.logIn(page);
    await h.pickDate(page, 8);
    const box = await addSwimTrip(page);

    await box.getByRole('button', { name: 'Edit Swim trip (4:30pm)' }).click();
    await expect(box.getByRole('heading', { name: 'Edit Swim trip (4:30pm)' })).toBeVisible();
    await expect(box.getByLabel('Name')).toHaveValue('Swim trip');
    await expect(box.getByLabel('Seats')).toHaveValue('8');
    await expect(box.getByLabel('Adult price (£)')).toHaveValue('45');
    await expect(box.getByLabel('Note to customers (optional)')).toHaveValue('Bring swimwear and a towel.');

    await box.getByLabel('Name').fill('Swimming trip');
    await box.getByLabel('Seats').fill('10');
    await box.getByLabel('Adult price (£)').fill('50');
    await box.getByRole('button', { name: 'Save changes' }).click(); // the "are you sure?" box is accepted
    await notice(page, 'Swimming trip (4:30pm) on');
    await expect(box.locator('.extraTrips li')).toContainText('Swimming trip (4:30pm): 10 seats, 1.5 hours, £50 adults, £30 children');
    await expect(box.getByRole('heading', { name: 'Add a trip' })).toBeVisible(); // back to adding
    await expect(page.locator('.calendarDisplay div', { hasText: 'Swimming trip' })).toContainText('10 spaces available');
});
