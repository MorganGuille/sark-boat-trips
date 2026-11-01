const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    asyncHandler = require('../middleware/asyncHandler.js'),
    honeypot = require('../middleware/honeypot.js'),
    { bookingByIp, bookingByEmail, availabilityByIp, manageViewByIp, manageChangeByIp, manageMessageByBooking } = require('../middleware/rateLimiters.js'),
    controller = require('../controllers/bookings.js'),
    checkout = require('../controllers/checkout.js'),
    trips = require('../controllers/trips.js'),
    manage = require('../controllers/manage.js');

// Public: used by the booking page. Sends the customer to Stripe to save a card; the booking is
// made once the card is saved (controllers/checkout.js).
router.post('/checkout', bookingByIp, bookingByEmail,
    honeypot((res) => res.json({ ok: false, data: 'Something went wrong. Please try again later.' })),
    asyncHandler(checkout.startCheckout('trip')));
router.post('/monthAvailability', availabilityByIp, asyncHandler(controller.checkMonthAvail))
// Public: the day's trips as they are that day (the owner may have moved one), for the booking page
router.get('/trips/:date', availabilityByIp, asyncHandler(trips.dayTrips))

// Public: the customer's own booking, from the link in their emails. The long random code in the
// address is what lets them in (controllers/manage.js).
router.get('/manage/:token', manageViewByIp, asyncHandler(manage.view))
router.post('/manage/:token/cancel', manageChangeByIp, asyncHandler(manage.cancel))
router.post('/manage/:token/party', manageChangeByIp, asyncHandler(manage.changeParty))
router.post('/manage/:token/message', manageChangeByIp, manageMessageByBooking, asyncHandler(manage.message))

// Dashboard only
router.post('/admin-add', requireAuth, asyncHandler(controller.adminAddBooking))
router.post('/cancel', requireAuth, asyncHandler(controller.cancelBooking))
router.post('/cancel-trip', requireAuth, asyncHandler(controller.cancelTrip))
router.post('/change-trip', requireAuth, asyncHandler(trips.changeTrip))
router.post('/message-trip', requireAuth, asyncHandler(trips.messageTrip))
router.post('/add-trip', requireAuth, asyncHandler(trips.addTrip))
router.post('/edit-trip', requireAuth, asyncHandler(trips.editTrip))
router.post('/remove-trip', requireAuth, asyncHandler(trips.removeTrip))
router.post('/restore', requireAuth, asyncHandler(controller.restoreBooking))
router.post('/mark-paid', requireAuth, asyncHandler(controller.markPaid))
router.post('/mark-unpaid', requireAuth, asyncHandler(controller.markUnpaid))
router.post('/permanently-delete', requireAuth, asyncHandler(controller.permanentlyDeleteBooking))
// before /:date, which would take "upcoming" and "search" for a date
router.get('/upcoming', requireAuth, asyncHandler(controller.upcoming))
router.get('/search', requireAuth, asyncHandler(controller.search))
router.get('/:date', requireAuth, asyncHandler(controller.checkDate))
router.get('/report/:month', requireAuth, asyncHandler(controller.monthlyReport))
router.get('/search/:search', requireAuth, asyncHandler(controller.searchByPath))
router.post('/update/:id', requireAuth, asyncHandler(controller.updateBooking));
router.post('/updateavailability', requireAuth, asyncHandler(controller.updateAvailability))



module.exports = router;
