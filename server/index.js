const app = require("express")()
const port = 4040;
const mongoose = require("mongoose")
const cors = require('cors');
require('dotenv').config()

let dbPassword = process.env.atlasDB_password;

app.use(require("express").json())
app.use(require("express").urlencoded({ extended: true }))
app.use(cors())

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