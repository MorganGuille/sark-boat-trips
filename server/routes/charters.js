const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/charters.js');

router.post('/create-checkout-session', controller.createCheckOutSession);
router.get('/verify-payment', controller.verifyPayment)




module.exports = router;
