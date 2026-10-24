const express = require('express'),
    router = express.Router(),
    requireAuth = require('../middleware/requireAuth.js'),
    asyncHandler = require('../middleware/asyncHandler.js'),
    controller = require('../controllers/notes.js');

router.post('/', requireAuth, asyncHandler(controller.addNote))
router.get('/:date', requireAuth, asyncHandler(controller.getNotesByDate))
router.delete('/:id', requireAuth, asyncHandler(controller.deleteNote))

module.exports = router;
