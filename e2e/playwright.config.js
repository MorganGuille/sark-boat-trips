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
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node e2e/server.js',
        cwd: path.join(__dirname, '..'),
        url: `http://127.0.0.1:${PORT}/admin/getSeasonDates`,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
        env: { E2E_PORT: String(PORT) },
    },
});
