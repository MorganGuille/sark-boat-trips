const Bookings = require("../models/bookings");



const addbooking = async (req, res) => {

    let { date, firstName, lastName, phone, adults, children, email } = req.body


    let array = await Bookings.find({ date: date })

    let total = 0
    array.forEach(element => {
        total += (element.adults + element.children)

    });
    let availability = (24 - total)

    if (availability >= (Number(adults) + Number(children))) {

        try {
            let newBooking = await Bookings.create(req.body);
            res.send({ ok: true, data: `Thanks ${firstName}, your booking for ${adults} adults and ${children} children on ${date} added successfully` })
        }
        catch (error) {
            res.send({ ok: false, data: "check console for errors" })
            console.log(error)
        }
    }
    else {
        res.send({ ok: false, data: 'no spaces available!' })
    }
}

const deletebooking = async (req, res) => {
    console.log("accessed")
    let { date, lastName } = req.body
    console.log(req.body)
    try {
        let delBooking = await Bookings.deleteOne({ date: date, lastName: lastName });
        res.send({ ok: true, data: `Booking for ${lastName} on ${date} deleted successfully` })
        console.log(delBooking)
    }
    catch (error) {
        res.send({ ok: false, data: "check console for errors" })
        console.log(error)
    }
}

const checkdate = async (req, res) => {
    let date = req.params.date
    try {

        let bookings = await Bookings.find({ date: date })
        res.send({ ok: true, data: bookings })
    }
    catch (error) {
        res.send({ ok: false, data: "check console for errors" })
        console.log(error)
    }
}

const checkAvail = async (req, res) => {
    let date = req.params.date

    let array = await Bookings.find({ date: date })

    let total = 0
    array.forEach(element => {
        total += (element.adults + element.children)

    });
    let availability = (24 - total)

    try {
        res.send({ ok: true, data: availability })
    }
    catch (error) {
        res.send({ ok: false, data: "check console for errors" })
        console.log(error)
    }
}

const search = async (req, res) => {

    let search = req.params.search

    let bookings = await Bookings.find({ lastName: search })
    try {
        res.send({ ok: true, data: bookings })
    } catch (error) {
        res.send({ ok: false, data: "check console for errors" })
        console.log(error)
    }

}


module.exports = { addbooking, deletebooking, checkdate, checkAvail, search }

