const express = require('express'),
    router = express.Router(),
    asyncHandler = require('../middleware/asyncHandler.js'),
    honeypot = require('../middleware/honeypot.js'),
    { checkoutByIp, verifyPaymentByIp } = require('../middleware/rateLimiters.js'),
    checkout = require('../controllers/checkout.js');

router.post('/create-checkout-session', checkoutByIp,
    honeypot((res) => res.json({ ok: false, data: 'Something went wrong. Please try again later.' })),
    asyncHandler(checkout.startCheckout('charter')));
// The success page, for trips and charters alike
router.get('/verify-payment', verifyPaymentByIp, asyncHandler(checkout.verifyPayment))




module.exports = router;
