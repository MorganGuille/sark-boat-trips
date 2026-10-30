// The one Stripe client, shared by online booking (controllers/checkout.js) and the card charges
// (utils/charges.js). With no usable key the placeholder is only there so webhooks can still be
// verified (that needs the signing secret, not a key). Nothing else calls Stripe while
// settings.stripe.problem is set.
const { settings } = require('./settings');

module.exports = require('stripe')(settings.stripe.key || 'sk_test_not_configured');
