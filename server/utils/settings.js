// Everything that depends on where the app is running (a laptop, Heroku, another host) comes
// from settings (environment variables), never from addresses typed into the code.

// Reads the settings from `env` and works out whether online booking (cards saved with Stripe) can safely run.
// Takes env as a parameter so the rules can be tested without touching the real environment.
const readSettings = (env = process.env) => {
    const isProduction = env.NODE_ENV === 'production';

    // Production uses STRIPEKEY. Anywhere else prefers STRIPETESTKEY, so a laptop can never charge
    // a real card by accident, even if the live key is sitting in its .env file.
    const key = (isProduction ? env.STRIPEKEY : env.STRIPETESTKEY || env.STRIPEKEY) || '';
    const mode = key.startsWith('sk_live') ? 'live' : key.startsWith('sk_test') ? 'test' : null;
    // A live key anywhere but production is never usable
    const keyUsable = Boolean(mode) && (isProduction || mode === 'test');

    // The public web address of the site, with no trailing slash. Stripe sends customers back to it
    // after saving their card, and the owner emails link to the dashboard on it.
    const publicUrl = String(env.PUBLIC_URL || '').trim().replace(/\/+$/, '');

    let problem = null;
    if (!key) problem = isProduction ? 'STRIPEKEY is not set' : 'STRIPETESTKEY is not set';
    else if (!mode) problem = 'the Stripe key is not a secret key (it should start with sk_test or sk_live)';
    else if (!keyUsable) problem = 'only a LIVE Stripe key is available but this is not production. Set STRIPETESTKEY to a test key so real cards cannot be charged here';
    else if (!publicUrl) problem = 'PUBLIC_URL is not set';
    else if (!/^https?:\/\/[^/\s]+/.test(publicUrl)) problem = 'PUBLIC_URL must start with http:// or https://';

    const warnings = [];
    if (isProduction && mode === 'test') warnings.push('production is using a Stripe TEST key, so card payments will not take real money');
    if (isProduction && publicUrl.startsWith('http://')) warnings.push('PUBLIC_URL is not https');
    if (!publicUrl) warnings.push('PUBLIC_URL is not set, so the dashboard link in owner emails will not work');

    return {
        isProduction,
        // Stripe's page asks customers to tick "I agree to the terms" (needs the terms address saved
        // in the Stripe dashboard first, or Stripe refuses every booking: so it is off unless set)
        termsConsent: String(env.STRIPE_TERMS_CONSENT || '').trim().toLowerCase() === 'true',
        publicUrl,
        dashboardUrl: `${publicUrl}/dashboard`,
        stripe: {
            // only ever a key that is safe to use in this environment, otherwise null
            key: keyUsable ? key : null,
            mode,
            problem, // why online booking is switched off, or null if it is on
        },
        warnings,
    };
};

module.exports = { readSettings, settings: readSettings() };
