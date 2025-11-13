const mongoose = require("mongoose");
require("dotenv").config();

const dbPassword = process.env.atlasDB_password;

async function connectMongoDB() {
  try {
    await mongoose.connect(
      `mongodb+srv://morganguille:${dbPassword}@bookingsdb.7bty4.mongodb.net/?retryWrites=true&w=majority&appName=BookingsDB`
    );
    console.log("MongoDB connected to the DB");
    return true;
  } catch (error) {
    console.error("MongoDB ERROR", error);
    return false;
  }
}

module.exports = connectMongoDB;
