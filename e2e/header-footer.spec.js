// The site header and footer on a laptop (owner's choices, 1 Nov 2026): option A, see-through over the
// home page's photo and white once you scroll or on any other page; the same links everywhere, with
// Charters going to the charters page and a gold Book a trip button; a footer with columns, no address,
// and the terms and privacy policy on their own pages. The phone version is tested in mobile.spec.js.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => {
    await h.asNewVisitor(page);
    await h.reset(request);
    await page.setViewportSize({ width: 1366, height: 800 });
});

test('on the home page the header is see-through over the photo, and turns white once you scroll', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header.siteHeader');
    await expect(header).toHaveClass(/overPhoto/);
    await page.mouse.wheel(0, 600);
    await expect(header).not.toHaveClass(/overPhoto/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveClass(/overPhoto/);
});

test('every page has the same header: logo home, the four links, and Book a trip', async ({ page }) => {
    for (const path of ['/terms', '/charters', '/canceled', '/bookings']) {
        await page.goto(path);
        const header = page.locator('header.siteHeader');
        await expect(header, `${path}: white, not see-through`).not.toHaveClass(/overPhoto/);
        const nav = header.getByRole('navigation', { name: 'Main' });
        for (const name of ['The tour', 'Charters', 'Sark Island', 'Reviews']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'The tour' })).toHaveAttribute('href', '/#theTour');
        await expect(header.locator('.headerBar').getByRole('link', { name: 'Book a trip' })).toHaveAttribute('href', '/bookings');
        // a visible gap between "Book" and "a trip" on screen (it once read "Booka trip": the space was in the
        // text but not drawn, so only measuring shows it)
        const gap = await header.locator('.headerBar .bookButton').evaluate((button) => {
            const book = document.createRange();
            book.selectNodeContents(button.firstChild);
            const rest = button.querySelector('.bookWide').firstChild;
            const first = rest.textContent.search(/[^\s\u00a0]/);
            const word = document.createRange();
            word.setStart(rest, first);
            word.setEnd(rest, first + 1);
            return word.getBoundingClientRect().left - book.getBoundingClientRect().right;
        });
        expect(gap, 'space between Book and a trip').toBeGreaterThan(2);
        await expect(header.getByRole('link', { name: 'Sark Boat Trips' }).first()).toHaveAttribute('href', '/');
    }
});

test('every header link goes to a section of the home page, Charters too (the owner found it jarring when it alone opened another page)', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(page.locator('.headerBar').getByRole('link', { name: 'Book a trip' })).toHaveAttribute('href', '#reservations');
    for (const [name, id] of [['The tour', 'theTour'], ['Charters', 'charters'], ['Sark Island', 'sarkIsland'], ['Reviews', 'reviews']]) {
        await expect(nav.getByRole('link', { name })).toHaveAttribute('href', `#${id}`);
    }
    await nav.getByRole('link', { name: 'Charters' }).click();
    await expect(page).toHaveURL(/\/#charters$/);
    await expect(page.locator('#charters')).toBeInViewport();
    await page.goto('/terms');
    await expect(nav.getByRole('link', { name: 'Charters' })).toHaveAttribute('href', '/#charters');
});

test('the footer: description, contact, links and social logos, no address, and the terms and privacy policy on their own pages', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('Discover Sark from the sea. Guided boat tours with local skippers.');
    await expect(footer).not.toContainText('Dixcart');
    await expect(footer.getByRole('link', { name: '+44 7911 764 246' })).toHaveAttribute('href', 'tel:+447911764246');
    await expect(footer.getByRole('link', { name: 'info@sarkboattrips.com' })).toHaveAttribute('href', 'mailto:info@sarkboattrips.com');
    await expect(footer.getByRole('link', { name: 'Charters' })).toHaveAttribute('href', '#charters');
    await expect(footer.getByRole('link', { name: 'Book a trip' })).toHaveAttribute('href', '#reservations');
    await expect(footer.locator('.footerSocial a')).toHaveCount(4);
    await expect(footer.getByRole('link', { name: 'Gift vouchers' })).toHaveAttribute('href', '/gift-vouchers');
    await expect(footer.getByRole('button')).toHaveCount(0); // no pop-up buttons

    await footer.getByRole('link', { name: 'Privacy policy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { name: 'Privacy Policy for Sark Boat Trips' })).toBeVisible();
    await page.locator('footer').getByRole('link', { name: 'Terms and conditions' }).click();
    await expect(page).toHaveURL(/\/terms$/);
});

// Charters (owner's choices, 1 Nov 2026): the price comes from the dashboard, so it can't be forgotten when it changes
test('the charter price on the home page and the charters page is the one set on the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#charters .factChips')).toContainText('£400 for the boat'); // the test settings: £400
    await expect(page.locator('#charters .factChips')).toContainText('Up to 12 people');
    await page.locator('#charters').getByRole('link', { name: 'Charter ideas and booking' }).click();
    await expect(page).toHaveURL(/\/charters$/);
    await expect(page.locator('h1')).toHaveText('Private charters');
    const facts = page.locator('.charterFacts');
    await expect(facts).toContainText('£400for the whole boat');
    await expect(facts).toContainText('Up to 12people');
    await expect(facts).not.toContainText('infants');
    await expect(page.locator('.ideaCard')).toHaveCount(4);
    await expect(page.locator('.ideaCard', { hasText: 'Beach explorer' }).locator('img')).toHaveAttribute('src', /beach-explorer/); // the owner's photo
    await expect(page.locator('.goodToKnow')).toContainText('Paddleboards and snorkelling gear are included');

    // the owner changes the price on the dashboard: both pages follow
    await h.logIn(page);
    await expect(page.locator('#priceCharter')).toHaveValue('400'); // the saved prices have loaded
    await page.getByRole('button', { name: /Edit season dates and prices/ }).click();
    await page.fill('#priceCharter', '450');
    await page.locator('form:has(#priceCharter) button[type=submit]').click();
    await expect(page.locator('.seasonSaved')).toContainText('charter £450');
    await page.goto('/charters');
    await expect(page.locator('.charterFacts')).toContainText('£450for the whole boat');
    await page.goto('/');
    await expect(page.locator('#charters .factChips')).toContainText('£450 for the boat');
});

test('Check dates on the charters page jumps to the booking form', async ({ page }) => {
    await page.goto('/charters');
    await page.getByRole('link', { name: 'Check dates' }).click();
    await expect(page).toHaveURL(/#book$/);
    await expect(page.getByRole('heading', { name: 'Book a private charter' })).toBeInViewport();
});

test('on a wide screen the charters facts line up with the page, not the edges of the screen', async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 1000 });
    await page.goto('/charters');
    const heading = await page.locator('h1').boundingBox();
    const ideas = await page.locator('.ideaCards').boundingBox();
    const first = await page.locator('.charterFacts dt').first().boundingBox();
    const last = await page.locator('.charterFacts div').last().boundingBox();
    expect(Math.abs(first.x - heading.x)).toBeLessThan(2); // starts where the heading does
    expect(last.x + last.width).toBeLessThanOrEqual(ideas.x + ideas.width + 40); // ends with the page, not at 2000px
});

