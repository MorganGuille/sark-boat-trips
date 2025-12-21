const express = require("express"),
  router = express.Router(),
  controller = require("../controllers/admin.js");

router.post("/login", controller.checklogin);
router.get("/getSeasonDates", controller.getSeasonDates);
router.post("/setSeasonDates", controller.setSeasonDates);

module.exports = router;
