const app = require("express")()
const port = 4040;
const mongoose = require("mongoose")

app.use(require("express").json())
app.use(require("express").urlencoded({ extended: true }))

async function connecting() {
    try {
        await mongoose.connect('mongodb://localhost:27017/bookings')
        console.log('Connected to the DB')
    } catch (error) {
        console.log('ERROR: Seems like your DB is not running, please start it up !!!');
    }
}
connecting()

app.use("/bookings", require("./routes/bookings"))

app.use(require("cors")())

app.listen(port, () => console.log(`listening on port : ${port}`))