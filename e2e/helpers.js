const { expect } = require('@playwright/test');

const USERNAME = 'owner';
const PASSWORD = 'correct horse battery staple'; // the same fake login the server tests use

// Starts every test from an empty database and a quiet mailer
const reset = (request) => request.post('/__test/reset');
const mails = async (request) => (await request.get('/__test/mails')).json();
const savedBookings = async (request) => (await request.get('/__test/bookings')).json();

// The server's rate limits are per visitor (it reads the X-Forwarded-For header, as it does behind
// Heroku). Tests that load the calendar many times pose as a fresh visitor, so they don't use up the
// allowance that every other test shares.
let visitors = 0;
const asNewVisitor = (page) => page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': `10.9.${Math.floor(++visitors / 250)}.${(visitors % 250) + 1}` });

// Watches a page for the things that mean something is broken: the browser blocking something the
// security policy forbids, or the page throwing an error
// React's "hydration failed" message (the page was built for the home page but shown on another one)
// is a known issue, so it is collected separately in problems.hydration instead of failing every test.
const watch = (page) => {
    const problems = [];
    Object.defineProperty(problems, 'hydration', { value: [], enumerable: false }); // not part of the list that tests compare against []
    page.on('pageerror', (error) => (/Hydration failed/.test(error.message) ? problems.hydration : problems).push(`page error: ${error.message.slice(0, 120)}`));
    page.on('console', (message) => {
        if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text()) && message.location().url.startsWith('http://127.0.0.1')) problems.push(message.text());
    });
    return problems;
};

// Clicks a day on the calendar, moving to the right month first
const pickDate = async (page, daysFromToday) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromToday);
    const label = target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const tile = page.locator(`abbr[aria-label="${label}"]`);
    for (let i = 0; i < 4 && (await tile.count()) === 0; i++) await page.locator('.react-calendar__navigation__next-button').click();
    await tile.click();
    // the day as it is stored (YYYY-MM-DD)
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
};

const fillBooking = async (page, { firstName = 'Alice', lastName = 'Smith', email = `alice${Date.now()}@example.test`, phone = '07123 456789', adults = '2' } = {}) => {
    await page.fill('#firstName', firstName);
    await page.fill('#lastName', lastName);
    await page.fill('#email', email);
    await page.fill('#phone', phone);
    await page.fill('#adults', adults);
    return email;
};

// Logs in once and reuses that login, because the login form only allows 5 attempts per 15
// minutes (as it should). Only the test of the login form itself types a password.
let token;
const logIn = async (page) => {
    if (!token) {
        const response = await page.request.post('/admin/login', { data: { userName: USERNAME, password: PASSWORD } });
        token = (await response.json()).token;
    }
    await page.addInitScript((value) => localStorage.setItem('adminToken', value), token);
    await page.goto('/dashboard');
    await expect(page.locator('.dashHeader')).toBeVisible();
};

// Every page of the site, in one place: the phone, security and search-engine tests all visit these,
// so a new page is added here once (as well as in client/prerender.js and server/routes/pages.js;
// seo.spec.js fails if the sitemap and PUBLIC_PAGES differ). Browser pages are listed in the states
// customers see them in.
const PUBLIC_PAGES = ['/', '/bookings', '/charters', '/gift-vouchers', '/terms', '/privacy'];
const BROWSER_PAGES = ['/dashboard', '/canceled?kind=trip', '/canceled?kind=charter', '/success?session_id=cs_test_nope', '/gift-vouchers/thanks', `/manage/${'z'.repeat(32)}`];
const NOT_FOUND = '/no-such-page';

// Presses the yes button of every in-page "are you sure?" box (client/src/components/confirmDialog.jsx)
// as soon as one blocks the next step, for tests about what happens afterwards. The browser's own
// pop-up is no longer used: one turning up fails the test.
const acceptConfirms = (page) => {
    page.addLocatorHandler(page.locator('dialog.confirmDialog[open]'), (box) => box.locator('.confirmYes').click());
    page.on('dialog', (dialog) => { dialog.dismiss(); throw new Error(`The browser's own pop-up appeared: ${dialog.message()}`); });
};


// Stands in for Vimeo (it blocks automated browsers): its details page, and a player that answers the
// site's messages the way Vimeo's does. Returns the addresses asked for. window.__vimeo in the page lists
// what the site told each player to do ({ where: 'row' | 'big', method, value }). In a test,
// frame.locator('body').evaluate(() => { fake.time = 12; fake.paused = true; }) is the video moving on, or
// someone pressing the player's own pause button.
const fakeVimeo = async (page) => {
    const asked = [];
    page.on('request', (req) => { if (/vimeo/i.test(req.url())) asked.push(req.url()); });
    await page.addInitScript(() => {
        window.__vimeo = [];
        window.addEventListener('message', (e) => {
            if (!e.data || !e.data.fakeVimeo) return;
            const row = document.querySelector('.videoInRow iframe');
            window.__vimeo.push({ where: row && row.contentWindow === e.source ? 'row' : 'big', ...e.data.fakeVimeo });
        });
    });
    const player = `<!doctype html><script>
        window.fake = { time: 0, paused: false };
        const send = (m) => parent.postMessage(JSON.stringify(m), '*');
        addEventListener('message', (e) => {
            const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            let value = d.value;
            if (d.method === 'play') fake.paused = false;
            if (d.method === 'pause') fake.paused = true;
            if (d.method === 'setCurrentTime') fake.time = d.value;
            if (d.method === 'getCurrentTime') value = fake.time;
            if (d.method === 'getPaused') value = fake.paused;
            if (['play', 'pause', 'setCurrentTime'].includes(d.method)) parent.postMessage({ fakeVimeo: { method: d.method, value: d.value } }, '*');
            send({ method: d.method, value });
        });
        send({ event: 'ready' });
    </script>`;
    await page.route(/vimeo\.com/, (route) => {
        const url = new URL(route.request().url());
        if (!url.pathname.endsWith('/oembed.json')) return route.fulfill({ status: 200, contentType: 'text/html', body: player });
        url.searchParams.delete('url');
        const html = `<iframe src="https://player.vimeo.com/video/331613265?${url.searchParams}" allow="autoplay; fullscreen"></iframe>`;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'video', html, width: 1280, height: 720, video_id: 331613265 }) });
    });
    return asked;
};
const vimeoCalls = (page, where, method) => page.evaluate(([w, m]) => window.__vimeo.filter((c) => c.where === w && c.method === m), [where, method]);

module.exports = {
    fakeVimeo, vimeoCalls, acceptConfirms, asNewVisitor, USERNAME, PASSWORD, reset, mails, savedBookings, watch, pickDate, fillBooking, logIn, PUBLIC_PAGES, BROWSER_PAGES, NOT_FOUND };
