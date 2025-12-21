const mongoose = require("mongoose");

const seasonDatesSchema = new mongoose.Schema({
  seasonStartDate: {
    type: Date,
    required: true,
  },
  seasonEndDate: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("Admin", seasonDatesSchema);
