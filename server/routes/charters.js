const express = require('express'),
    router = express.Router(),
    asyncHandler = require('../middleware/asyncHandler.js'),
    controller = require('../controllers/charters.js');

router.post('/create-checkout-session', asyncHandler(controller.createCheckOutSession));
router.get('/verify-payment', asyncHandler(controller.verifyPayment))




module.exports = router;
