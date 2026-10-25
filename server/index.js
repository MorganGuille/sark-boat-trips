// Starts the real server: reads .env, connects to the database and listens on a port.
// The .env file MUST be loaded before anything else, because settings (Stripe keys, PUBLIC_URL and
// so on) are read the moment the app's files are loaded. Tests load app.js directly instead.
require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const { settings } = require("./utils/settings");
const { corsSummary } = require("./middleware/security");
const { readDatabase } = require("./utils/database");

const PORT = process.env.PORT || 4040;
const dbname = process.env.atlasDB_name;
const database = readDatabase(process.env);

// Fail fast if the admin auth config is missing
for (const key of ["JWT_SECRET", "admin_username", "admin_password_hash"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment`);
    process.exit(1);
  }
}

// A laptop must never be pointed at the real bookings (see utils/database.js)
if (database.problem) {
  console.error(`Database: ${database.problem}`);
  process.exit(1);
}

// Connect to MongoDB. MONGODB_URI overrides the Atlas address (for another database or host).
async function connecting() {
  try {
    await mongoose.connect(database.uri);
    console.log(`Connected to ${dbname || "the database"}${database.user ? ` as ${database.user}` : ""}`);
  } catch (error) {
    console.log("ERROR: Could not connect to DB");
  }
}
connecting();

// Last resort: log a stray rejected promise instead of letting it kill the server
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

console.log(
  settings.stripe.problem
    ? `Charter payments are OFF: ${settings.stripe.problem}`
    : `Charter payments are ON (Stripe ${settings.stripe.mode} mode), customers return to ${settings.publicUrl}`,
);
settings.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
console.log(corsSummary());

app.listen(PORT, () => console.log(`listening on port : ${PORT}`));
