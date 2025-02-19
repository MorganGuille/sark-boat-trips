const Bookings = require("../models/bookings");



const addbooking = async (req, res) => {
    let { date, firstName, lastName, phone, adults, children, email, timeslot } = req.body;

    try {
        const existingBookings = await Bookings.find({ date, timeslot });
        let total = 0;
        existingBookings.forEach(element => {
            total += (element.adults + element.children);
        });

        const availability = 12 - total;

        if (availability >= (Number(adults) + Number(children))) {
            let newBooking = await Bookings.create(req.body);
            res.send({ ok: true, data: `Thanks ${firstName}, your booking for ${adults} adults and ${children} children on ${date} at ${timeslot} added successfully` });
        } else {
            res.send({ ok: false, data: `No spaces available at ${timeslot} on ${date}!` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const deletebooking = async (req, res) => {
    let { date, lastName, timeslot } = req.body;


    try {
        let delBooking = await Bookings.deleteOne({ date, lastName, timeslot });

        if (delBooking.deletedCount === 0) {
            return res.status(404).send({ ok: false, data: `No booking found for ${lastName} on ${date} at ${timeslot}` });
        }

        res.send({ ok: true, data: `Booking for ${lastName} on ${date} at ${timeslot} deleted successfully` });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

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
    const date = req.params.date;

    try {
        const availability = {
            '11am': await calculateAvailability(date, '11am'),
            '2pm': await calculateAvailability(date, '2pm'),
        };

        res.send({ ok: true, data: availability });
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "An error occurred." });
    }
};

const calculateAvailability = async (date, timeslot) => {
    const existingBookings = await Bookings.find({ date, timeslot });
    let total = 0;
    existingBookings.forEach(booking => {
        total += (booking.adults + booking.children);
    });
    return 12 - total;
};

const search = async (req, res) => {
    let search = req.params.search;
    try {
        let bookings = await Bookings.find({ lastName: { $regex: search, $options: 'i' } });
        res.send({ ok: true, data: bookings });
    } catch (error) {
        console.error("Error searching bookings:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};


module.exports = { addbooking, deletebooking, checkdate, checkAvail, search }

