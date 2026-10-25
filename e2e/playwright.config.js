const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4600;

module.exports = defineConfig({
    testDir: __dirname,
    testMatch: '*.spec.js',
    fullyParallel: false,
    workers: 1, // the tests share one database, and reset it at the start of each test
    timeout: 60000,
    expect: { timeout: 10000 },
    reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: path.join(__dirname, '..', 'playwright-report') }]] : 'list',
    outputDir: path.join(__dirname, '..', 'test-results'),
    use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        // The calendar's season blocking has broken on Apple devices before (Safari reads dates
        // differently). These run only that one spec: WebKit is the engine inside every iPhone, iPad
        // and Mac Safari, and the Pixel is Android's Chrome.
        { name: 'android-phone', testMatch: 'calendar-devices.spec.js', use: { ...devices['Pixel 7'] } },
        { name: 'iphone', testMatch: 'calendar-devices.spec.js', use: { ...devices['iPhone 14'] } },
        { name: 'mac-safari', testMatch: 'calendar-devices.spec.js', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: {
        command: 'node e2e/server.js',
        cwd: path.join(__dirname, '..'),
        url: `http://127.0.0.1:${PORT}/admin/getSeasonDates`,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
        env: { E2E_PORT: String(PORT) },
    },
});
