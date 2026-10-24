// Usage: node server/scripts/hash-password.js
// Prompts for a password (hidden) and prints the line to add to .env / Heroku config.
const readline = require("readline");
const bcrypt = require("bcryptjs");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

let muted = false;
rl._writeToOutput = (str) => {
  if (!muted) rl.output.write(str);
};

rl.question("New admin password: ", async (password) => {
  muted = false;
  rl.close();
  console.log();

  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  console.log("Add this to server/.env (keep the single quotes) and remove admin_password:\n");
  console.log(`admin_password_hash='${hash}'`);
  console.log("\nFor Heroku:\n");
  console.log(`heroku config:set admin_password_hash='${hash}'`);
});

muted = true;
