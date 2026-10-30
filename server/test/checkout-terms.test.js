// With STRIPE_TERMS_CONSENT=true, Stripe's card page asks the customer to agree to the terms.
// (Settings are read once per process, so this needs its own file.)
const t = require('./helpers');
t.setEnv({ STRIPE_TERMS_CONSENT: 'true' });
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

before(() => t.startDb());
after(() => t.stopDb());

describe('asking customers to agree to the terms', () => {
    it('is switched on by the setting, for trips and charters', async () => {
        await t.call(app, 'post', '/bookings/checkout', { body: t.booking() });
        await t.call(app, 'post', '/charters/create-checkout-session', { body: t.booking({ date: t.day(12) }) });
        assert.equal(mocks.stripe.created.length, 2);
        for (const params of mocks.stripe.created) assert.deepEqual(params.consent_collection, { terms_of_service: 'required' });
    });
    it('is off unless the setting says true (Stripe refuses it until the terms address is saved there)', () => {
        const { readSettings } = require('../utils/settings');
        assert.equal(readSettings({}).termsConsent, false);
        assert.equal(readSettings({ STRIPE_TERMS_CONSENT: 'yes' }).termsConsent, false);
        assert.equal(readSettings({ STRIPE_TERMS_CONSENT: ' TRUE ' }).termsConsent, true);
    });
});
