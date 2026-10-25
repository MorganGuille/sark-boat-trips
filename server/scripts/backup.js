// Saves a copy of every collection in the database to a dated folder on this computer.
// Atlas's free tier makes no backups of its own, so this is the only safety net.
//
// Usage (from the server folder, so it reads the same .env as the app):
//   node scripts/backup.js                 the sandbox database
//   node scripts/backup.js --production    the live database (only READS it). Needs
//                                          atlasDB_user_prod and atlasDB_user_prod_password in .env
//                                          (atlasDB_name_prod too if the live database isn't called Test)
//   node scripts/backup.js --out <folder>  choose the folder (default: backups/ in the project)
//
// Each backup is a folder of one file per collection. The files hold customer names, emails and
// phone numbers: keep them private and never commit them (backups/ is in .gitignore).
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { readDatabase } = require("../utils/database");

const args = process.argv.slice(2);
const production = args.includes("--production");
const outRoot = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(__dirname, "..", "..", "backups");

const environment = () => {
  if (!production) return process.env;
  const { atlasDB_user_prod: user, atlasDB_user_prod_password: password, atlasDB_name_prod: name } = process.env;
  if (!process.env.MONGODB_URI && (!user || !password)) {
    throw new Error("--production needs atlasDB_user_prod and atlasDB_user_prod_password in .env (uncomment them).");
  }
  // Only the connection is switched to production mode; this script never writes to the database
  return { ...process.env, NODE_ENV: "production", atlasDB_name: name || "Test", atlasDB_user: user, atlasDB_user_password: password };
};

const stamp = () => new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");

(async () => {
  const database = readDatabase(environment());
  if (database.problem) throw new Error(database.problem);
  await mongoose.connect(database.uri);
  const db = mongoose.connection.db;
  const { EJSON } = mongoose.mongo.BSON;

  const dir = path.join(outRoot, `${mongoose.connection.name}-${stamp()}`);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Backing up ${mongoose.connection.name} (${production ? "PRODUCTION, read only" : "sandbox"}) to ${dir}\n`);

  const counts = {};
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    // EJSON keeps ids, dates and numbers exactly, so a restore gives back the same data
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, undefined, 1, { relaxed: false }));
    counts[name] = docs.length;
    console.log(`  ${name}: ${docs.length}`);
  }
  fs.writeFileSync(path.join(dir, "_backup.json"), JSON.stringify({ database: mongoose.connection.name, takenAt: new Date().toISOString(), counts }, null, 2));
  console.log("\nDone. These files contain customer details: keep them private.");
  await mongoose.disconnect();
})().catch((error) => {
  console.error("Backup failed:", error.message);
  process.exit(1);
});
