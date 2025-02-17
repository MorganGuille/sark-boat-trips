const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/admin.js');

router.post('/login', controller.checklogin);






module.exports = router;