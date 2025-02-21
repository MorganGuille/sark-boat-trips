const app = require("express")()
const port = process.env.PORT || 3030;
const mongoose = require("mongoose")
const cors = require('cors');
const path = require('path');
require('dotenv').config()
const express = require('express');


let dbPassword = process.env.atlasDB_password;

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '../client/build')));

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

app.listen(port, () => console.log(`listening on port : ${port}`))

app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});