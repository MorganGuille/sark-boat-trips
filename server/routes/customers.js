const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    asyncHandler = require('../middleware/asyncHandler.js'),
    customers = require('../controllers/customers.js');

// Dashboard only: everything held for one customer, downloaded or erased (spec P2-13)
router.get('/', requireAuth, asyncHandler(customers.show));
router.get('/export', requireAuth, asyncHandler(customers.download));
router.post('/erase', requireAuth, asyncHandler(customers.eraseCustomer));

module.exports = router;
