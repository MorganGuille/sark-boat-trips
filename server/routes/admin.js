const express = require("express"),
  router = express.Router(),
  rateLimit = require("express-rate-limit"),
  requireAuth = require("../middleware/requireAuth.js"),
  controller = require("../controllers/admin.js");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, data: "Too many login attempts, try again later" },
});

router.post("/login", loginLimiter, controller.checklogin);
router.get("/getSeasonDates", controller.getSeasonDates);
router.post("/setSeasonDates", requireAuth, controller.setSeasonDates);

module.exports = router;
