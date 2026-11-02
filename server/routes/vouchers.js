const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    asyncHandler = require('../middleware/asyncHandler.js'),
    honeypot = require('../middleware/honeypot.js'),
    { voucherByIp, voucherByEmail, verifyPaymentByIp } = require('../middleware/rateLimiters.js'),
    vouchers = require('../controllers/vouchers.js');

// Public: the Gift vouchers page sends the buyer to Stripe to pay, and the thank-you page checks it
router.post('/checkout', voucherByIp, voucherByEmail,
    honeypot((res) => res.json({ ok: false, data: 'Something went wrong. Please try again later.' })),
    asyncHandler(vouchers.startVoucherCheckout));
router.get('/verify', verifyPaymentByIp, asyncHandler(vouchers.verifyVoucher));

// Dashboard only
router.get('/', requireAuth, asyncHandler(vouchers.list));
router.post('/add', requireAuth, asyncHandler(vouchers.add));
router.post('/use', requireAuth, asyncHandler(vouchers.use));
router.post('/undo', requireAuth, asyncHandler(vouchers.undo));
router.post('/resend', requireAuth, asyncHandler(vouchers.resend));
router.post('/extend', requireAuth, asyncHandler(vouchers.extend));
router.get('/:id/pdf', requireAuth, asyncHandler(vouchers.pdf));

module.exports = router;
