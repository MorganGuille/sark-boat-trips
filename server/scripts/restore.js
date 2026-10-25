// Puts a backup (made by backup.js) back into the SANDBOX database.
//
// Usage (from the server folder):
//   node scripts/restore.js <backup folder>            report only, changes nothing
//   node scripts/restore.js <backup folder> --apply    add what is missing
//
// It only ADDS documents that aren't in the database any more (matched by id). It never changes or
// deletes anything that is there, so running it twice is harmless. It refuses to run outside the
// sandbox: restoring into the live database is a decision to make by hand, with the backup open.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { readDatabase } = require("../utils/database");

const apply = process.argv.includes("--apply");
const folder = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

(async () => {
  if (!folder || !fs.existsSync(path.join(folder, "_backup.json"))) throw new Error("Give the backup folder, e.g. node scripts/restore.js ../backups/Bookings-Sandbox-2026-10-25_101500");
  const database = readDatabase(process.env);
  if (database.problem) throw new Error(database.problem);
  await mongoose.connect(database.uri);
  const db = mongoose.connection.db;
  const { EJSON } = mongoose.mongo.BSON;
  const info = JSON.parse(fs.readFileSync(path.join(folder, "_backup.json"), "utf8"));
  console.log(`Backup of ${info.database} taken ${info.takenAt}`);
  console.log(`Restoring into ${mongoose.connection.name} (${apply ? "APPLYING changes" : "report only, nothing will be changed"})\n`);

  for (const name of Object.keys(info.counts)) {
    const docs = EJSON.parse(fs.readFileSync(path.join(folder, `${name}.json`), "utf8"));
    const present = new Set((await db.collection(name).find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)));
    const missing = docs.filter((d) => !present.has(String(d._id)));
    console.log(`  ${name}: ${docs.length} in the backup, ${missing.length} missing from the database`);
    if (apply && missing.length) await db.collection(name).insertMany(missing);
  }
  console.log(apply ? "\nDone." : "\nRun again with --apply to add the missing ones.");
  await mongoose.disconnect();
})().catch((error) => {
  console.error("Restore failed:", error.message);
  process.exit(1);
});
