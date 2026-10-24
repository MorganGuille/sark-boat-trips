const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    controller = require('../controllers/notes.js');

router.post('/', requireAuth, controller.addOrUpdateNote)
router.get('/:date', requireAuth, controller.getNotesByDate)

module.exports = router;
