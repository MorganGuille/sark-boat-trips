const express = require('express');
const app = express()
const PORT = process.env.PORT || 4040;

const mongoose = require("mongoose")
const cors = require('cors');
const path = require('path');
require('dotenv').config()

let dbPassword = process.env.atlasDB_password;

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '../client/dist')));

async function connecting() {
    try {
        await mongoose.connect(`mongodb+srv://morganguille:${dbPassword}@bookingsdb.7bty4.mongodb.net/?retryWrites=true&w=majority&appName=BookingsDB`)
        console.log('Connected to the DB')
    } catch (error) {
        console.log('ERROR: Seems like your DB is not running, please start it up !!!');
    }
}
connecting()

app.use("/bookings", require("./routes/bookings"))
app.use("/admin", require("./routes/admin"))
app.use("/charters", require("./routes/charters"))
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});
app.use(express.static('public'));

app.listen(PORT, () => console.log(`listening on port : ${PORT}`))

