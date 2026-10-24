const express = require("express"),
  router = express.Router(),
  rateLimit = require("express-rate-limit"),
  requireAuth = require("../middleware/requireAuth.js"),
  asyncHandler = require("../middleware/asyncHandler.js"),
  controller = require("../controllers/admin.js");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, data: "Too many login attempts, try again later" },
});

router.post("/login", loginLimiter, asyncHandler(controller.checklogin));
router.get("/getSeasonDates", asyncHandler(controller.getSeasonDates));
router.post("/setSeasonDates", requireAuth, asyncHandler(controller.setSeasonDates));

module.exports = router;
