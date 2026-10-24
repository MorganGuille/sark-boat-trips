// One-off cleanup for seat counts left behind by old charters.
//
// Charters used to block a trip by overwriting that trip's capacity with the party size. They now
// block it by simply existing as a booking, so those old capacity rows only do harm: if the
// charter was later cancelled or deleted, the trip stayed stuck at the party size.
//
// Usage (from the server folder, so it reads the same .env as the app):
//   node scripts/cleanup-charter-capacity.js           report only, changes nothing
//   node scripts/cleanup-charter-capacity.js --apply   delete the rows it is sure about
//
// It deletes a row only when a charter booking exists for the same date and timeslot and the
// row's capacity equals that charter's party size. Any other custom capacity is listed for you
// to review but left alone, because it may be a setting you chose yourself.
require("dotenv").config();
const mongoose = require("mongoose");

const apply = process.argv.includes("--apply");
const dbname = process.env.atlasDB_name;

const toDate = (ddmmyyyy) => {
  const [d, m, y] = ddmmyyyy.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const today = new Date(new Date().setHours(0, 0, 0, 0));
const byDate = (a, b) => toDate(a.date) - toDate(b.date);
const line = (row) => `  ${row.date} ${row.timeslot}  capacity ${row.capacity}${toDate(row.date) >= today ? "" : "  (past)"}`;

(async () => {
  await mongoose.connect(
    `mongodb+srv://morganguille:${process.env.atlasDB_password}@bookingsdb.7bty4.mongodb.net/${dbname}?retryWrites=true&w=majority&appName=BookingsDB`,
  );
  const db = mongoose.connection.db;
  console.log(`Database: ${dbname} (${apply ? "APPLYING changes" : "report only, nothing will be changed"})\n`);

  const charters = await db.collection("bookings").find({ charter: "true" }).toArray();
  const partySizes = new Map();
  for (const c of charters) {
    const key = `${c.date}|${c.timeslot}`;
    const size = (Number(c.adults) || 0) + (Number(c.children) || 0);
    partySizes.set(key, [...(partySizes.get(key) || []), size]);
  }

  const rows = await db.collection("availabilities").find({}).toArray();
  const fromCharter = [];
  const review = [];
  for (const row of rows) {
    if ((partySizes.get(`${row.date}|${row.timeslot}`) || []).includes(row.capacity)) fromCharter.push(row);
    else if (row.capacity !== 12) review.push(row);
  }

  console.log(`Left behind by a charter (safe to remove): ${fromCharter.length}`);
  fromCharter.sort(byDate).forEach((r) => console.log(line(r)));
  console.log(`\nOther custom capacities, left alone (check these are ones you set): ${review.length}`);
  review.sort(byDate).forEach((r) => console.log(line(r)));

  if (apply && fromCharter.length) {
    const result = await db.collection("availabilities").deleteMany({ _id: { $in: fromCharter.map((r) => r._id) } });
    console.log(`\nDeleted ${result.deletedCount} row(s).`);
  } else if (fromCharter.length) {
    console.log("\nRun again with --apply to delete the first list.");
  }
  await mongoose.disconnect();
})().catch((error) => {
  console.error("Cleanup failed:", error.message);
  process.exit(1);
});
