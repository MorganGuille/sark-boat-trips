const express = require("express");
const app = express();
const PORT = process.env.PORT || 4040;
const helmet = require("helmet");

const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

let dbPassword = process.env.atlasDB_password;
let dbname = process.env.atlasDB_name;

// Fail fast if the admin auth config is missing
for (const key of ["JWT_SECRET", "admin_username", "admin_password_hash"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment`);
    process.exit(1);
  }
}

// Trust Heroku's single proxy hop (keeps req.ip honest for rate limiting)
app.set("trust proxy", 1);

// HSTS security header
app.use(
  helmet.hsts({
    maxAge: 15552000,
    includeSubDomains: true,
    preload: true,
  }),
);

// Force HTTPS (production only, so local http://localhost works)
app.use((req, res, next) => {
  if (req.secure || process.env.NODE_ENV !== "production") return next();
  res.redirect(301, `https://${req.headers.host}${req.url}`);
});

// Stripe webhooks need the raw request body to verify their signature, so this route
// is registered before express.json() and parses the body itself.
app.post(
  "/charters/webhook",
  express.raw({ type: "application/json" }),
  require("./middleware/asyncHandler")(require("./controllers/charters").webhook),
);

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
      `mongodb+srv://morganguille:${dbPassword}@bookingsdb.7bty4.mongodb.net/${dbname}?retryWrites=true&w=majority&appName=BookingsDB`,
    );
    console.log(`Connected to ${dbname}`);
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

// Must come after every route
app.use(require("./middleware/errorHandler"));

// Last resort: log a stray rejected promise instead of letting it kill the server
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

app.listen(PORT, () => console.log(`listening on port : ${PORT}`));
