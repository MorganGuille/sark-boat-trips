const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/bookings.js');

router.post('/add', controller.addBooking);
router.post('/delete', controller.deleteBooking)
router.get('/:date', controller.checkDate)
router.post('/monthAvailability', controller.checkMonthAvail)
router.get('/search/:search', controller.search)
router.post('/update/:id', controller.updateBooking);
router.post('/updateavailability', controller.updateAvailability)



module.exports = router;
