const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    asyncHandler = require('../middleware/asyncHandler.js'),
    honeypot = require('../middleware/honeypot.js'),
    { bookingByIp, bookingByEmail, availabilityByIp } = require('../middleware/rateLimiters.js'),
    controller = require('../controllers/bookings.js');

// Public: used by the booking page
router.post('/add', bookingByIp, bookingByEmail,
    honeypot((res) => res.send({ ok: true, data: 'Thanks, your booking request has been received.' })),
    asyncHandler(controller.addBooking));
router.post('/monthAvailability', availabilityByIp, asyncHandler(controller.checkMonthAvail))

// Dashboard only
router.post('/admin-add', requireAuth, asyncHandler(controller.adminAddBooking))
router.post('/cancel', requireAuth, asyncHandler(controller.cancelBooking))
router.post('/restore', requireAuth, asyncHandler(controller.restoreBooking))
router.post('/permanently-delete', requireAuth, asyncHandler(controller.permanentlyDeleteBooking))
router.get('/:date', requireAuth, asyncHandler(controller.checkDate))
router.get('/search/:search', requireAuth, asyncHandler(controller.search))
router.post('/update/:id', requireAuth, asyncHandler(controller.updateBooking));
router.post('/updateavailability', requireAuth, asyncHandler(controller.updateAvailability))



module.exports = router;
