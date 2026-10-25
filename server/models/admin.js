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
  // Ticket prices in pence (4000 = £40). Infants are always free. See utils/prices.js
  adultPrice: { type: Number, min: 0 },
  childPrice: { type: Number, min: 0 },
  charterPrice: { type: Number, min: 0 },
});

module.exports = mongoose.model("Admin", seasonDatesSchema);
