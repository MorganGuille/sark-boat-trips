const express = require("express");
const app = express();
const PORT = process.env.PORT || 4040;
const helmet = require("helmet");

const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

let dbPassword = process.env.atlasDB_password;

// Trust Heroku proxy
app.enable("trust proxy");

// HSTS security header
app.use(
  helmet.hsts({
    maxAge: 15552000,
    includeSubDomains: true,
    preload: true,
  }),
);

// Force HTTPS
app.use((req, res, next) => {
  if (req.secure) return next();
  res.redirect(`https://${req.headers.host}${req.url}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve client build
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("/robots.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/robots.txt"));
});

// Connect to MongoDB
async function connecting() {
  try {
    await mongoose.connect(
      `mongodb+srv://morganguille:${dbPassword}@bookingsdb.7bty4.mongodb.net/?retryWrites=true&w=majority&appName=BookingsDB`,
    );
    console.log("Connected to the DB");
  } catch (error) {
    console.log("ERROR: Could not connect to DB");
  }
}
connecting();

// API routes
app.use("/bookings", require("./routes/bookings"));
app.use("/admin", require("./routes/admin"));
app.use("/charters", require("./routes/charters"));
app.use("/notes", require("./routes/notes"));

// Optional public folder
app.use(express.static("public"));

// Catch-all for React Router
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () => console.log(`listening on port : ${PORT}`));
