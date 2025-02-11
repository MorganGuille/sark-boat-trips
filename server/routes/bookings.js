const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/bookings.js');

router.post('/add', controller.addbooking);
router.post('/delete', controller.deletebooking)
router.get('/:date', controller.checkdate)
router.get('/availability/:date', controller.checkAvail)




module.exports = router;