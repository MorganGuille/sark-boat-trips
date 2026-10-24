const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    controller = require('../controllers/bookings.js');

// Public: used by the booking page
router.post('/add', controller.addBooking);
router.post('/monthAvailability', controller.checkMonthAvail)

// Dashboard only
router.post('/delete', requireAuth, controller.deleteBooking)
router.get('/:date', requireAuth, controller.checkDate)
router.get('/search/:search', requireAuth, controller.search)
router.post('/update/:id', requireAuth, controller.updateBooking);
router.post('/updateavailability', requireAuth, controller.updateAvailability)



module.exports = router;
