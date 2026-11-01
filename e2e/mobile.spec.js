// Every page on a small phone (spec P2-14): most customers book on one. Each page must fit the screen
// (no sideways scrolling), start below the menu button, keep its text out from under the footer, and
// have boxes of at least 16px (smaller ones make an iPhone zoom in when tapped). Runs on desktop Chrome
// set to phone width, and on the Android and iPhone projects (see playwright.config.js).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const WIDTH = 360; // a small Android phone; iPhones are 375 to 430

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
    await page.setViewportSize({ width: WIDTH, height: 740 });
});

const dayFromNow = (days) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
};

const CODE = 'm'.repeat(32);
const booking = (fields = {}) => ({
    date: dayFromNow(6), firstName: 'Bartholomew', lastName: 'Featherstonehaugh-Smith', email: 'bart@example.test', phone: '+44 7700 900123',
    adults: 2, children: 1, paymentStatus: 'card_saved', cardLabel: 'Visa •••• 4242 (expires 08/28)', prices: { adult: 4000, child: 2500, charter: 40000 },
    manageToken: CODE, reference: 'SBT-MOB234', message: 'Wheelchair user, please help at the steps', ...fields,
});

// The things that go wrong on a phone, measured on the page as it is
const check = async (page, path) => {
    const found = await page.evaluate(() => {
        const footer = document.querySelector('footer').getBoundingClientRect().top + window.scrollY;
        const heading = document.querySelector('main h1, main h2, h1, h2');
        const boxes = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')]
            .filter((el) => el.offsetParent && parseFloat(getComputedStyle(el).fontSize) < 16)
            .map((el) => el.id || el.name || el.tagName);
        // text that ends up under the footer (it used to, on the success page)
        const underFooter = [...document.querySelectorAll('main p, main h1, main h2, main a.btn')]
            .filter((el) => el.offsetParent && el.getBoundingClientRect().bottom + window.scrollY > footer + 1)
            .map((el) => el.textContent.trim().slice(0, 40));
        return {
            wider: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            headingTop: heading ? heading.getBoundingClientRect().top + window.scrollY : null,
            boxes,
            underFooter,
        };
    });
    expect(found.wider, `${path} is wider than the screen`).toBeLessThanOrEqual(0);
    // the menu button is 4rem (64px) from the top of the screen
    expect(found.headingTop, `${path}: the heading starts under the menu button`).toBeGreaterThanOrEqual(64);
    expect(found.boxes, `${path}: boxes under 16px`).toEqual([]);
    expect(found.underFooter, `${path}: text under the footer`).toEqual([]);
};

for (const path of ['/', '/bookings', '/charters', '/terms', '/privacy', '/canceled?kind=trip', '/canceled?kind=charter', '/no-such-page']) {
    test(`${path} fits a phone`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('h1, h2').first()).toBeVisible();
        await page.waitForLoadState('networkidle').catch(() => {});
        await check(page, path);
    });
}

test('the success page fits a phone, from the heading to the contact details (it was cut off at both ends)', async ({ page, request }) => {
    // as this visitor (page.request), with a new email, so the booking limits per visitor and per email aren't used up
    const response = await page.request.post('/bookings/checkout', {
        data: { date: dayFromNow(7), timeslot: '2pm', firstName: 'Bartholomew', lastName: 'Featherstonehaugh-Smith', email: `bart${Date.now()}@example.test`, phone: '07123456789', adults: 2, children: 1, infants: 0 },
    });
    expect(response.ok()).toBe(true);
    const { id } = await (await request.post('/__test/complete-checkout')).json();
    await page.goto(`/success?session_id=${id}`);
    await expect(page.locator('h1')).toHaveText('Success!');
    await check(page, '/success');
    // the last line (the WhatsApp number) is above the footer, so it can be read and tapped
    const whatsapp = await page.getByRole('link', { name: '+44 7911 764 246' }).first().boundingBox();
    const footer = await page.locator('footer').boundingBox();
    expect(whatsapp.y + whatsapp.height).toBeLessThanOrEqual(footer.y);
});

test('the success page that could not confirm a booking fits a phone', async ({ page }) => {
    await page.goto('/success?session_id=cs_test_nope');
    await expect(page.locator('h1')).toHaveText("We couldn't confirm your booking");
    await check(page, '/success');
});

test('manage my booking fits a phone', async ({ page, request }) => {
    await request.post('/__test/insert-booking', { data: booking() });
    await page.goto(`/manage/${CODE}`);
    await expect(page.getByRole('heading', { name: 'Hello Bartholomew' })).toBeVisible();
    await check(page, '/manage');
});

test('on a phone the dashboard\'s season and prices are a row each, lined up (they were jumbled on the owner\'s Pixel)', async ({ page }) => {
    await h.logIn(page);
    await expect(page.locator('#seasonStart')).not.toHaveValue('');
    const box = async (selector) => page.locator(selector).boundingBox();
    // locked, the dates are text (Android drew the locked date boxes wider and cut the dates off)
    const dates = page.locator('.dashHeader .settingText');
    await expect(dates).toHaveCount(2);
    await expect(page.locator('#seasonStart')).toBeHidden();
    for (let i = 0; i < 2; i++) {
        const fits = await dates.nth(i).evaluate((el) => el.scrollWidth <= el.clientWidth && /^\d{1,2} \w{3} \d{4}$/.test(el.textContent));
        expect(fits, `the whole date shows: ${await dates.nth(i).textContent()}`).toBe(true);
    }
    const start = await dates.nth(0).boundingBox();
    const end = await dates.nth(1).boundingBox();
    expect(Math.abs(end.y - start.y), 'both season dates on one line').toBeLessThan(4);
    const prices = await Promise.all(['#priceAdult', '#priceChild', '#priceCharter'].map(box));
    for (const price of prices) expect(Math.abs(price.y - prices[0].y), 'the three prices on one line').toBeLessThan(4);
    const adultLabel = await box('label[for="priceAdult"]');
    expect(Math.abs(adultLabel.x - start.x), 'the prices start where the dates do').toBeLessThan(4);
    const card = await box('.dashHeader');
    for (const b of [end, prices[2]]) expect(b.x + b.width, 'inside the panel').toBeLessThanOrEqual(card.x + card.width);
    await check(page, '/dashboard');
});

test('on phones and tablets the booking steps line up: "1 Choose a day" starts where steps 2 to 4 do', async ({ page }) => {
    for (const width of [WIDTH, 412, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/bookings');
        await expect(page.locator('.stepTitle')).toBeVisible();
        const lefts = await page.evaluate(() => [document.querySelector('.stepTitle'), ...document.querySelectorAll('.bookStep legend')]
            .map((el) => Math.round(el.getBoundingClientRect().left)));
        expect(lefts.length, 'four steps').toBe(4);
        expect(new Set(lefts).size, `at ${width}px the steps start at ${lefts.join(', ')}`).toBe(1);
    }
});

test('the hero fills the screen and keeps its size as the address bar slides away (with dvh it changed size and the page jumped)', async ({ page }) => {
    await page.goto('/');
    const hero = await page.evaluate(() => {
        // the height the stylesheet asks for (the emulator can't slide a real address bar away, so check the unit)
        let asked = null;
        for (const sheet of document.styleSheets) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            for (const rule of rules) if (rule.selectorText === '.hero-banner') asked = rule.style.getPropertyValue('height');
        }
        return { asked, height: document.querySelector('.hero-banner').getBoundingClientRect().height, screen: window.innerHeight };
    });
    expect(hero.asked, 'the steady screen height, not dvh').toBe('100svh');
    expect(Math.abs(hero.height - hero.screen), 'the hero fills the screen').toBeLessThan(2);
});

test('the video fills its frame at 16:9 on a phone, with Watch a trip inside it and big enough to tap', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.videoFrame');
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    expect(Math.abs(box.width / box.height - 16 / 9), 'the video\'s own shape (no black bars)').toBeLessThan(0.02);
    expect(box.x + box.width).toBeLessThanOrEqual(WIDTH);
    const play = await page.getByRole('button', { name: /Watch a trip/ }).boundingBox();
    expect(play.height).toBeGreaterThanOrEqual(44);
    expect(play.y + play.height, 'inside the frame').toBeLessThanOrEqual(box.y + box.height);
});

test('the review links are rows one under another on a phone, inside the screen and easy to tap', async ({ page }) => {
    await page.goto('/');
    const reviews = page.locator('#reviews');
    await expect(reviews).toContainText('Rated 5 stars on every site');
    let lastBottom = 0;
    for (const site of ['Google', 'Tripadvisor', 'Facebook']) {
        const row = reviews.getByRole('link', { name: `Read our reviews on ${site}, rated 5.0 out of 5` });
        await row.scrollIntoViewIfNeeded();
        const box = await row.boundingBox();
        expect(box.x, `${site}: left edge on the screen`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${site}: right edge on the screen`).toBeLessThanOrEqual(WIDTH);
        expect(box.height, `${site}: big enough to tap`).toBeGreaterThanOrEqual(44);
        const top = box.y + (await page.evaluate(() => window.scrollY));
        expect(top, `${site} is under the one before`).toBeGreaterThan(lastBottom - 1);
        lastBottom = top + box.height;
    }
});

test('from any page, the menu goes to the home page sections, and closes when a link is tapped (it used to stay open over the page)', async ({ page }) => {
    await page.goto('/terms');
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(menu).toBeVisible();
    const tour = menu.getByRole('link', { name: 'The tour' });
    await expect(tour).toHaveAttribute('href', '/#theTour');
    await tour.click();
    await expect(page).toHaveURL(/\/#theTour$/);
    await expect(menu).toBeHidden();
    await expect(page.locator('#theTour')).toBeInViewport();

    // on the home page too, where the links only scroll the page
    await page.getByRole('button', { name: 'Open menu' }).click();
    await menu.getByRole('link', { name: 'Reviews' }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('#reviews')).toBeInViewport();
});

test('the phone header: Book is one tap away, and the menu has big rows, Book a trip, the phone number and a close button', async ({ page }) => {
    await page.goto('/terms');
    const book = page.locator('.headerBar').getByRole('link', { name: 'Book', exact: true });
    await expect(book).toHaveAttribute('href', '/bookings');
    const box = await book.boundingBox();
    expect(box.x + box.width, 'Book is on the screen').toBeLessThanOrEqual(WIDTH);

    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.locator('#mobile-menu');
    for (const name of ['The tour', 'Charters', 'Sark Island', 'Reviews']) {
        const row = await menu.getByRole('link', { name, exact: true }).boundingBox();
        expect(row.height, `${name} is easy to tap`).toBeGreaterThanOrEqual(44);
    }
    await expect(menu.getByRole('link', { name: 'Book a trip' })).toHaveAttribute('href', '/bookings');
    await expect(menu.getByRole('link', { name: '+44 7911 764 246' })).toHaveAttribute('href', 'tel:+447911764246');
    // the close button has focus, and Escape closes the menu and goes back to the menu button
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
});

test('the footer on a phone: stacked, the social logos big enough to tap, and the terms on their own page (no pop-up)', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    for (const name of ['Visit our Facebook page', 'Visit our Instagram profile', 'Read our reviews on Tripadvisor', 'Find us on Google']) {
        const icon = await footer.getByRole('link', { name }).boundingBox();
        expect(icon.height, name).toBeGreaterThanOrEqual(44);
        expect(icon.x + icon.width, `${name} on the screen`).toBeLessThanOrEqual(WIDTH);
    }
    await footer.getByRole('link', { name: 'Terms and conditions' }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { name: 'Terms and Conditions - Sark Boat Trips' })).toBeVisible();
});

test('on a phone the dashboard shows each booking as a card, with its buttons on screen and 16px boxes', async ({ page, request }) => {
    await request.post('/__test/insert-booking', { data: booking({ date: dayFromNow(0) }) });
    await h.logIn(page);
    const row = page.locator('.bookingsTable tbody tr').first();
    await expect(row).toContainText('Bartholomew Featherstonehaugh-Smith');
    // each detail has its heading next to it, as there is no table header to read across
    await expect(row.locator('td[data-label="Contact"]')).toContainText('bart@example.test');
    for (const name of ['Edit', 'Mark paid', 'Cancel']) {
        const button = await row.getByRole('button', { name, exact: true }).boundingBox();
        expect(button.x + button.width, `${name} is on the screen`).toBeLessThanOrEqual(WIDTH);
        expect(button.height, `${name} is big enough to tap`).toBeGreaterThanOrEqual(40);
    }
    await check(page, '/dashboard');
});
