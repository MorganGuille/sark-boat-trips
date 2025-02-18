const Bookings = require("../models/bookings");


const checklogin = async (req, res) => {
    console.log("accessed")
    let { userName, password } = req.body
    console.log(req.body)
    try {
        if (userName === process.env.admin_username && password === process.env.admin_password) {
            res.send({ ok: true, data: true })
        } else {
            res.send({ ok: false, data: false })
        }
    }
    catch {
        res.send({ ok: false, data: `Error` })
    }
}

const updateBooking = async (req, res) => {
    const { date, firstName, lastName, phone, adults, children, email, accommodation, message } = req.body;
    const bookingId = req.params.id;

    try {
        const updatedBooking = await Bookings.findOneAndUpdate(
            { _id: bookingId },
            { date, firstName, lastName, phone, adults, children, email, accommodation, message },
            { new: true, runValidators: true }
        );

        if (!updatedBooking) {
            return res.status(404).send({ ok: false, data: 'Booking not found!' });
        }

        res.send({ ok: true, data: `Booking for ${firstName} ${lastName} on ${date} updated successfully` });
    } catch (error) {
        res.status(500).send({ ok: false, data: "Error updating booking", error });
        console.log(error);
    }
}

const deleteAll = async (req, res) => {
    try {
        const result = await Bookings.deleteMany({});
        res.status(200).json({ message: `${result.deletedCount} records deleted.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to clear records." });
    }
};




module.exports = { checklogin, deleteAll, updateBooking }