// The public booking page, as a customer sees it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request, page }) => { await h.asNewVisitor(page); await h.reset(request); });

test('the page loads with the calendar and seat counts, and nothing is blocked or broken', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/bookings');
    await expect(page.locator('.react-calendar')).toBeVisible();
    await h.pickDate(page, 8); // a day ahead: today's trips close for booking an hour before they leave
    await expect(page.locator('.tripCard').first()).toContainText('12 spaces left');
    // the prices come from the owner's settings, not from the page
    const prices = page.getByRole('list', { name: 'Prices' });
    await expect(prices).toContainText('Adults £40');
    await expect(prices).toContainText('Children (4 to 14) £25');
    await expect(prices).toContainText('Infants (3 and under) free');
    await expect(page.locator('.priceTotal')).toContainText('Total £40'); // 1 adult to start with
    expect(problems).toEqual([]);
});

test('a customer saves a card on Stripe\'s page, comes back to a confirmation, and both sides are emailed', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    const email = await h.fillBooking(page, { firstName: 'Alice', email: 'alice@example.test', adults: '2' });
    await expect(page.locator('.cardNotice')).toContainText('Nothing is charged now');
    await expect(page.locator('.cardNotice')).toContainText('cancel free of charge up to 24 hours before');
    await expect(page.locator('.cardNotice a')).toHaveAttribute('href', '/terms');
    await page.click('button:has-text("Continue to card details")');
    await page.waitForURL('https://checkout.stripe.test/**');
    expect(await h.savedBookings(request), 'nothing is booked until the card is saved').toHaveLength(0);

    // the customer saves their card on Stripe and is sent back
    const { id } = await (await request.post('/__test/complete-checkout')).json();
    await page.goto(`/success?session_id=${id}`);
    await expect(page.locator('h1')).toHaveText('Success!');
    // stored as YYYY-MM-DD, but a customer reads it day-month-year
    const british = date.split('-').reverse().join('-');
    await expect(page.locator('main')).toContainText(`booked for 11am on ${british}`);
    await expect(page.locator('main')).toContainText('Visa •••• 4242');
    await expect(page.locator('main')).toContainText('nothing has been taken yet');
    await expect(page.locator('main')).toContainText('£80 will be charged when your trip starts');
    await expect(page.locator('main')).toContainText('Use the Manage your booking button in your confirmation email, up to 24 hours before');

    const saved = await h.savedBookings(request);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ date, firstName: 'Alice', adults: 2, timeslot: '11am', status: 'active', paymentStatus: 'card_saved' });
    const sent = (await h.mails(request)).filter((m) => m.result === 'sent').map((m) => m.to).sort();
    expect(sent).toEqual([email, 'owner@sarkboattrips.test'].sort());

    await page.reload();
    await expect(page.locator('h1')).toHaveText('Success!');
    expect(await h.savedBookings(request), 'a refresh makes no second booking').toHaveLength(1);
});

test('a parent with a toddler: the infant box is free, takes a seat, and shows on the dashboard', async ({ page, request }) => {
    await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fake Stripe page</h1>' }));
    await page.goto('/bookings');
    await expect(page.locator('label[for="infants"]')).toHaveText('Infants3 and under, free');
    await expect(page.locator('label[for="children"]')).toHaveText('Children4 to 14');
    await h.pickDate(page, 9);
    await h.fillBooking(page, { firstName: 'Parent', adults: '1' });
    await page.getByRole('button', { name: 'More infants' }).click();
    await expect(page.locator('.priceTotal')).toContainText('1 adult × £40 + 1 infant free');
    await page.click('button:has-text("Continue to card details")');
    await page.waitForURL('https://checkout.stripe.test/**');
    const { id } = await (await request.post('/__test/complete-checkout')).json();
    await page.goto(`/success?session_id=${id}`);
    await expect(page.locator('main')).toContainText('£40 will be charged', { timeout: 15000 });
    expect((await h.savedBookings(request))[0]).toMatchObject({ adults: 1, children: 0, infants: 1 });

    // on the dashboard (which opens on today, so find the booking by name)
    await h.logIn(page);
    await page.fill('#bookingSearch', 'Smith');
    await page.click('form[role=search] button[type=submit]');
    await expect(page.locator('.byDayRow:has-text("Parent")')).toContainText('1 adult, 1 infant');
});

test('a booking the server refuses shows the reason and keeps what the customer typed', async ({ page, request }) => {
    await page.goto('/bookings');
    const date = await h.pickDate(page, 9);
    await expect(page.locator('.tripCard').first()).toContainText('12 spaces left'); // the page has the seats as they were
    await request.post('/__test/insert-booking', { data: { date, adults: 12 } }); // someone else fills the 11am trip meanwhile
    await h.fillBooking(page, { firstName: 'Latecomer', email: 'late@example.test', adults: '2' });
    await page.click('button:has-text("Continue to card details")');
    await expect(page.locator('.formError')).toContainText('is full. Please choose another trip.');
    await expect(page.locator('#firstName')).toHaveValue('Latecomer');
    // the cards are reloaded: the 11am now shows Full, and the 2pm is chosen instead
    await expect(page.locator('.tripCard', { has: page.locator('input[value="11am"]') })).toContainText('Full');
    await expect(page.locator('input[value="2pm"]')).toBeChecked();
    expect(await h.savedBookings(request)).toHaveLength(1);
});

test('the terms have their own page (Stripe links to it) with the payment and cancellation rules', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/terms');
    const terms = page.locator('main');
    await expect(terms.locator('h2')).toHaveText('Terms and Conditions - Sark Boat Trips');
    await expect(terms).toContainText('Nothing is charged when you book.');
    await expect(terms).toContainText('cancel at least 24 hours before your trip starts');
    await expect(terms).toContainText('Private charters: cancel at least 48 hours before');
    await expect(terms).toContainText('If we cancel, you won\'t be charged');
    await expect(terms).toContainText('infants (3 and under) go free');
    await expect(terms).not.toContainText('deposit');
    expect(problems).toEqual([]);
});

test('the privacy policy has its own page (Stripe links to it) and explains the saved card', async ({ page }) => {
    const problems = h.watch(page);
    await page.goto('/privacy');
    const policy = page.locator('main');
    await expect(policy.locator('h2')).toHaveText('Privacy Policy for Sark Boat Trips');
    await expect(policy).toContainText('your card is saved and later charged by Stripe');
    await expect(policy).toContainText('We never see or store your full card number');
    await expect(policy).toContainText('until you ask us to remove them');
    await expect(policy).not.toContainText('**');
    await expect(policy).not.toContainText('For charter bookings');
    expect(problems).toEqual([]);
    await page.goto('/terms');
    await expect(page.locator('main a[href="/privacy"]')).toHaveText('privacy policy');
});

test('the booking page tells customers how cancelling works', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page.locator('.bookingPoints')).toContainText('Free cancellation up to 24 hours before');
    await page.goto('/charters');
    await expect(page.locator('.bookingPoints')).toContainText('Free cancellation up to 48 hours before');
    await expect(page.locator('.charterFacts')).toContainText('up to 48 hours before');
    await expect(page.locator('.goodToKnow')).toContainText('Free cancellation up to 48 hours before');
    await expect(page.locator('.cardNotice')).toContainText('up to 48 hours before');
    // written differently, it is still the charter page (it used to show the trip booking form)
    await page.goto('/Charters/');
    await expect(page.locator('.bookingPoints')).toContainText('Free cancellation up to 48 hours before');
    await expect(page.locator('.cardNotice')).toContainText('up to 48 hours before');
});

test('closing Stripe\'s page leads to a page saying nothing was booked or charged', async ({ page }) => {
    await page.goto('/canceled');
    await expect(page.locator('main')).toContainText('nothing has been booked');
    await expect(page.locator('main')).toContainText('nothing has been charged');
    // Try again goes back to the booking page (trips are the default), and there is a way home
    await expect(page.getByRole('link', { name: 'Return to the booking page to try again' })).toHaveAttribute('href', '/bookings');
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/canceled?kind=charter');
    await expect(page.getByRole('link', { name: 'Return to the charters page to try again' })).toHaveAttribute('href', '/charters');
    await page.goto('/canceled?kind=trip');
    await page.getByRole('link', { name: 'Return to the booking page to try again' }).click();
    await expect(page).toHaveURL(/\/bookings$/);
});

test('a bot that fills in the hidden field is not seen by people, and gets nothing saved', async ({ page, request }) => {
    await page.goto('/bookings');
    const box = await page.locator('#website_url').boundingBox();
    expect(box.x).toBeLessThan(-1000); // off the screen
    await expect(page.locator('#website_url')).toHaveAttribute('tabindex', '-1');
    const response = await request.post('/bookings/checkout', { data: { date: '2099-01-01', timeslot: '11am', firstName: 'Bot', lastName: 'Bot', email: 'bot@example.test', phone: '1', adults: '2', website_url: 'http://spam.example' } });
    expect((await response.json()).url).toBeUndefined();
    expect(await h.savedBookings(request)).toHaveLength(0);
});

test('the video: nothing from Vimeo loads until Watch a trip is tapped, then Vimeo\'s player starts with its controls and no tracking', async ({ page }) => {
    // Vimeo blocks automated browsers, so its pages are stood in for; what matters is when they are asked for
    const vimeo = [];
    const scripts = []; // the site's own code files, as the page fetches them
    page.on('request', (req) => {
        if (/vimeo/i.test(req.url())) vimeo.push(req.url());
        if (req.resourceType() === 'script' && !/vimeo\.com/.test(req.url())) scripts.push(req.url());
    });
    // The player first asks Vimeo for the video's details (oEmbed), sending its settings; answer as Vimeo does
    await page.route(/vimeo\.com/, (route) => {
        const url = new URL(route.request().url());
        if (!url.pathname.endsWith('/oembed.json')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' });
        url.searchParams.delete('url');
        const html = `<iframe src="https://player.vimeo.com/video/331613265?${url.searchParams}" allow="autoplay; fullscreen"></iframe>`;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'video', html, width: 1280, height: 720, video_id: 331613265 }) });
    });
    await page.goto('/');
    const play = page.getByRole('button', { name: /Watch a trip/ });
    await play.scrollIntoViewIfNeeded();
    await expect(play).toContainText('About 1 minute');
    await page.waitForLoadState('networkidle');
    expect(vimeo, 'nothing from Vimeo, not even its code, before the tap').toEqual([]);
    await expect(page.locator('.videoFrame iframe')).toHaveCount(0);

    const scriptsBefore = scripts.length;
    await play.click();
    const iframe = page.locator('.videoFrame iframe');
    await expect(iframe).toHaveAttribute('src', /player\.vimeo\.com\/video\/331613265/);
    // the settings sent to Vimeo
    const asked = new URL(vimeo.find((u) => u.includes('/oembed.json'))).searchParams;
    const on = (name) => ['1', 'true'].includes(asked.get(name)); // Vimeo takes either
    expect(on('dnt'), 'Vimeo\'s "do not track": no cookies').toBe(true);
    expect(on('autoplay'), 'starts once tapped').toBe(true);
    expect(['0', 'false'].includes(asked.get('controls')), 'the normal player, with controls').toBe(false);
    expect(on('background'), 'not the silent background mode').toBe(false);
    expect(on('muted'), 'with its music').toBe(false);
    await expect(play).toHaveCount(0);
    // the player's code was a separate file, fetched by the tap (not part of every visit)
    expect(scripts.length, 'a new code file was fetched when play was tapped').toBeGreaterThan(scriptsBefore);
});

// The home page below the photo (owner, 2 Nov 2026): the wording and photos the owner chose, the order of
// the sections, and the links that must work. One visit, so it stays quick.
test('home page: the tour facts (dashboard prices), reviews after the tour, the owner\'s wording and photos, and real links', async ({ page }) => {
    await page.goto('/');
    const facts = page.locator('.tourFacts');
    await expect(facts).toContainText('Max 12people on board');
    await expect(facts).toContainText('£40 adult£25 child, under 4s free'); // the test settings' prices
    await expect(facts.locator('div')).toHaveCount(4); // the owner's four facts (no Creux Harbour)
    await expect(page.locator('.tourCards')).toContainText('and other marine life');
    await expect(page.locator('main')).not.toContainText('basking sharks');

    const order = await page.locator('main > section[id]').evaluateAll((sections) => sections.map((s) => s.id));
    expect(order.indexOf('reviews'), 'reviews follow the tour').toBe(order.indexOf('theTour') + 1);
    const quotes = page.locator('#reviews .reviewQuotes figure');
    await expect(quotes).toHaveCount(3);
    await expect(quotes.nth(0)).toContainText('Richard W., Google');
    await expect(quotes.nth(2)).toContainText("puffin colony at L'Etac");
    const tops = await quotes.evaluateAll((all) => all.map((q) => Math.round(q.getBoundingClientRect().top)));
    expect(new Set(tops).size, 'one row of quotes on a laptop').toBe(1);

    await expect(page.locator('.boatSection')).toContainText('when she was converted for fishing');
    await expect(page.locator('.boatSection img')).toHaveAttribute('src', /dorado/);
    await expect(page.locator('#charters img')).toHaveAttribute('src', /charter-swim/);

    const island = page.locator('#sarkIsland');
    await expect(island).not.toContainText('30 minutes');
    await expect(island.getByRole('link', { name: /sarkshipping\.gg/ })).toHaveAttribute('href', 'https://www.sarkshipping.gg');
    await expect(island.getByRole('link', { name: '+44 1481 832107' })).toHaveAttribute('href', 'tel:+441481832107');
    await expect(island.getByRole('link', { name: 'suebnbsark@gmail.com' })).toHaveAttribute('href', 'mailto:suebnbsark@gmail.com');

    await expect(page.locator('#reservations .bookingPoints')).toContainText('Save a card: nothing taken now');
    await expect(page.locator('.giftBand')).toContainText('Give a trip around Sark');
});

test('home page photos: every photo described, never moving by itself, moved by the arrows and by dragging with the mouse', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const row = page.locator('.photoStripRow');
    await row.scrollIntoViewIfNeeded();
    const photos = row.locator('img');
    await expect(photos).toHaveCount(12);
    for (const alt of await photos.evaluateAll((imgs) => imgs.map((img) => img.alt))) expect(alt.length).toBeGreaterThan(10);
    await expect(page.locator('.photoStrip h2')).toHaveClass(/sr-only/); // a clean row: the heading is only for screen readers
    const back = page.getByRole('button', { name: 'Earlier photos' });
    await expect(back).toBeHidden(); // nothing before the first photo
    await page.waitForTimeout(6000); // the old slideshow moved on every 5 seconds
    expect(await row.evaluate((el) => el.scrollLeft)).toBe(0);

    await page.getByRole('button', { name: 'More photos' }).click();
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(400);
    await expect(back).toBeVisible();

    const before = await row.evaluate((el) => el.scrollLeft);
    const box = await row.boundingBox();
    await page.mouse.move(box.x + 700, box.y + 150);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 150, { steps: 8 });
    await page.mouse.move(box.x + 200, box.y + 150, { steps: 8 });
    await page.mouse.up();
    expect(await row.evaluate((el) => el.scrollLeft), 'dragged further along').toBeGreaterThan(before + 300);
});

test('a new form starts plain: the dashboard booking form\'s styles don\'t reach other forms (P3-5)', async ({ page }) => {
    // they used to be bare "form div", "form button" and "input" rules that every form on every page picked up
    const plainForm = () => {
        const form = document.createElement('form');
        form.innerHTML = '<div><input id="plainInput"></div><button id="plainButton">Go</button>';
        document.querySelector('main, body').append(form);
        const style = (el) => getComputedStyle(el);
        return {
            divWidth: style(form.querySelector('div')).width, divDisplay: style(form.querySelector('div')).display,
            button: style(form.querySelector('button')).backgroundColor, inputMargin: style(form.querySelector('input')).marginTop,
        };
    };
    for (const url of ['/', '/gift-vouchers']) {
        await page.goto(url);
        const seen = await page.evaluate(plainForm);
        expect(seen.divDisplay, url).toBe('block');
        expect(seen.divWidth, url).not.toBe('350px');
        expect(seen.button, url).not.toBe('rgb(16, 135, 255)');
        expect(seen.inputMargin, url).toBe('0px');
    }
});
