const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    asyncHandler = require('../middleware/asyncHandler.js'),
    honeypot = require('../middleware/honeypot.js'),
    { bookingByIp, bookingByEmail, availabilityByIp } = require('../middleware/rateLimiters.js'),
    controller = require('../controllers/bookings.js'),
    checkout = require('../controllers/checkout.js');

// Public: used by the booking page. Sends the customer to Stripe to save a card; the booking is
// made once the card is saved (controllers/checkout.js).
router.post('/checkout', bookingByIp, bookingByEmail,
    honeypot((res) => res.json({ ok: false, data: 'Something went wrong. Please try again later.' })),
    asyncHandler(checkout.startCheckout('trip')));
router.post('/monthAvailability', availabilityByIp, asyncHandler(controller.checkMonthAvail))

// Dashboard only
router.post('/admin-add', requireAuth, asyncHandler(controller.adminAddBooking))
router.post('/cancel', requireAuth, asyncHandler(controller.cancelBooking))
router.post('/cancel-trip', requireAuth, asyncHandler(controller.cancelTrip))
router.post('/restore', requireAuth, asyncHandler(controller.restoreBooking))
router.post('/mark-paid', requireAuth, asyncHandler(controller.markPaid))
router.post('/mark-unpaid', requireAuth, asyncHandler(controller.markUnpaid))
router.post('/permanently-delete', requireAuth, asyncHandler(controller.permanentlyDeleteBooking))
router.get('/:date', requireAuth, asyncHandler(controller.checkDate))
router.get('/report/:month', requireAuth, asyncHandler(controller.monthlyReport))
router.get('/search/:search', requireAuth, asyncHandler(controller.search))
router.post('/update/:id', requireAuth, asyncHandler(controller.updateBooking));
router.post('/updateavailability', requireAuth, asyncHandler(controller.updateAvailability))



module.exports = router;
