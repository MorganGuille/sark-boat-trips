const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/bookings.js');

router.post('/add', controller.addbooking);
router.post('/delete', controller.deletebooking)
router.get('/:date', controller.checkdate)





module.exports = router;