const Bookings = require("../models/bookings");

const addbooking = async (req, res) => {

    let { date, firstName, lastName, phone, adults, children, email } = req.body

    let totaladults = Bookings.aggregate(
        [
            {
                $group:
                {
                    date: date,
                    totalAdults: { $sum: adults },
                }
            }
        ])

    console.log(totaladults[])

    try {

        let newBooking = await Bookings.create(req.body);
        res.send({ ok: true, data: `Booking for ${firstName} ${lastName} on ${date} added successfully` })

    }
    catch (e) {
        res.send({ ok: false, data: e })
    }
}

const deletebooking = async (req, res) => {
    console.log("accessed")
    let { date, lastName, phone, } = req.body
    console.log(req.body)
    try {
        let delBooking = await Bookings.deleteOne({ date: date, lastName: lastName, phone: phone });
        res.send({ ok: true, data: `Booking for ${lastName} on ${date} deleted successfully` })
        console.log(delBooking)
    }
    catch {
        res.send({ ok: false, data: `Error` })
    }
}



const checkdate = async (req, res) => {
    let date = req.params.date
    console.log(date)
    try {
        console.log("trying")
        let bookings = await Bookings.find({ date: date })
        res.send({ ok: true, data: bookings })
    }
    catch {
        res.send({ ok: false, data: `Error` })
    }
}


module.exports = { addbooking, deletebooking, checkdate }

