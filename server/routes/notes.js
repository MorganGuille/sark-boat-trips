const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    controller = require('../controllers/notes.js');

router.post('/', requireAuth, controller.addNote)
router.get('/:date', requireAuth, controller.getNotesByDate)
router.delete('/:id', requireAuth, controller.deleteNote)

module.exports = router;
