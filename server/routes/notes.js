const express = require('express'),
    router = express.Router(),
    controller = require('../controllers/notes.js');

router.post('/', controller.addOrUpdateNote)
router.get('/:date', controller.getNotesByDate)

module.exports = router;