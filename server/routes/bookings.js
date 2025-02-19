const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/bookings.js');

router.post('/add', controller.addBooking);
router.post('/delete', controller.deleteBooking)
router.get('/:date', controller.checkDate)
router.get('/availability/:date', controller.checkAvail)
router.get('/search/:search', controller.search)
router.post('/update/:id', controller.updateBooking);



module.exports = router;
