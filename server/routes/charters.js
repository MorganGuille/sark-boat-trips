const express = require('express'),
    router = express.Router(),
    asyncHandler = require('../middleware/asyncHandler.js'),
    honeypot = require('../middleware/honeypot.js'),
    { checkoutByIp, verifyPaymentByIp } = require('../middleware/rateLimiters.js'),
    controller = require('../controllers/charters.js');

router.post('/create-checkout-session', checkoutByIp,
    honeypot((res) => res.json({ ok: false, data: 'Something went wrong. Please try again later.' })),
    asyncHandler(controller.createCheckOutSession));
router.get('/verify-payment', verifyPaymentByIp, asyncHandler(controller.verifyPayment))




module.exports = router;
