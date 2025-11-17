const express = require("express");
const app = express();
const PORT = process.env.PORT || 4040;

const cors = require("cors");
const path = require("path");
require("dotenv").config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "../client/dist")));

// const mongoose = require("mongoose")

// let dbPassword = process.env.atlasDB_password;

// async function connecting() {
//     try {
//         await mongoose.connect(`mongodb+srv://morganguille:${dbPassword}@bookingsdb.7bty4.mongodb.net/?retryWrites=true&w=majority&appName=BookingsDB`)
//         console.log('Connected to the DB')
//     } catch (error) {
//         console.log('ERROR: Seems like your DB is not running, please start it up !!!');
//     }
// }
// connecting()

const connectMongo = require("./data-access/mongoDB/index");
connectMongo();

const { getClient, query } = require("./data-access/postgresql/index");
app.set("db_postgres_query", query);
app.set("db_postgres_client", getClient);

app.use("/bookings", require("./routes/bookings"));
app.use("/admin", require("./routes/admin"));
app.use("/charters", require("./routes/charters"));
app.use("/notes", require("./routes/notes"));
app.get("/*", function (req, res) {
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
});
app.use(express.static("public"));

app.listen(PORT, () => console.log(`listening on port : ${PORT}`));
