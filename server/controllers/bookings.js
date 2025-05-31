const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.gmail_address,
        pass: process.env.gmail_password,
    },
});

const sendEmail = async (mailOptions) => {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

const getAvailability = async (date, timeslot) => {
    try {
        const availabilitySettings = await Availability.findOne({ date, timeslot });
        const capacity = availabilitySettings ? availabilitySettings.capacity : 12;

        const existingBookings = await Bookings.find({ date, timeslot });
        let total = 0;
        existingBookings.forEach(booking => {
            total += (booking.adults + booking.children);
        });

        return capacity - total;
    } catch (error) {
        console.error("Error calculating availability:", error);
        throw error;
    }
};

const updateAvailability = async (req, res) => {
    const { date, timeslot, capacity } = req.body;

    try {
        let availability = await Availability.findOneAndUpdate(
            { date, timeslot },
            { capacity },
            { upsert: true, new: true }
        );

        res.send({ ok: true, data: `Sucessfully updated availability, there are now ${availability.capacity} seats available at ${availability.timeslot}` });
    } catch (error) {
        console.error("Error updating availability:", error);
        res.status(500).send({ ok: false, data: "An error occurred while updating availability." });
    }
};


const addBooking = async (req, res) => {
    let { date, firstName, lastName, phone, adults, children = 0, email, timeslot, message, accommodation } = req.body;
    let childResponse = ``
    Number(children) > 0 ? childResponse = `and ${children} children` : childResponse = ``

    try {

        const availability = await getAvailability(date, timeslot);

        if (availability >= (Number(adults) + Number(children))) {

            const mailOptionsClient = {
                from: 'sarkboattrips@gmail.com',
                to: email,
                subject: 'Booking Confirmation Sark Boat Trips',
                html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                <div style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                        alt="Sark Boat Trips" width="42" height="42"
                        style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                <h3>Dear ${firstName},</h3>
                <p>Your booking for ${adults} adults and ${children} children on ${date} at ${timeslot} has been confirmed.</p>
                <p>Please be at the <strong>Creux Harbour</strong> shortly before ${timeslot}, bring weather appropriate
                clothing and any snacks
                and drinks you'd like.</p>
                <p>Payment is at the end of the trip and you can pay either by cash or card.</p>
                <p>If you have any questions, please dont hesitate to ask</p>
                <br>
                <p><strong>Please note that due to weather or availability we may need to change the time of your trip.</strong>
                </p>
                <p>We will contact you if anything changes!</p>
                <br>
                <p>Thank you so much,</p>
                <h3>Sark Boat Trips</h3>
                <hr>
                <br>
                <div style="text-align: center;">
                <a style="color: white; text-decoration: none; margin: 0; padding: 0;"
                    href="https://maps.app.goo.gl/E2XLJqrGku7eDePZ8" target='_blank'>&#9875 Creux Harbour, Sark</a>
                <br>
                <a style="color: white; text-decoration: none;" href="tel:+44-7911-764-246">&#9990 +44 7911 764 246</a>
                <br>
                <a style="color: white; text-decoration: none;" href="mailto:sarkboattrips@gmail.com">&#9993
                    sarkboattrips@gmail.com</a>
        </div>
    </div>
</div>`,
            };

            const mailOptionsAdmin = {
                from: 'sarkboattrips@gmail.com',
                to: 'sarkboattrips@gmail.com',
                subject: `New Booking ${date}`,
                html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <h3>New Booking ${date}</h3>
                                <p>A new booking has been made by:</p>
                                <p><strong>${firstName} ${lastName}</strong></p>
                                <p>for ${adults} adults and ${children} children </p>
                                <p>on ${date} at ${timeslot}.</p>
                                <hr>
                                <p>Message:</p>
                                <p>${message}</p>
                                <hr>
                                <p>Email : ${email}</p>
                                <p>Phone : ${phone}</p>
                                <p>Accommodation : ${accommodation}</p>
                                <hr>
                                <br>
                                <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                                    href="https://www.sarkboattrips.com/dashboard" target='_blank'>Go to dashboard</a>
                            </div>
                        </div>`,
            };
            try {
                await sendEmail(mailOptionsClient);
                await sendEmail(mailOptionsAdmin);
                let newBooking = await Bookings.create(req.body);
                res.send({
                    ok: true, data: `Thanks ${firstName}, your booking for ${adults} adults ${childResponse} on
                            ${date} at ${timeslot} has been reserved. Please check your email for confirmation (Dont forget to check the spam folder!)`

                });
            } catch (emailError) {
                console.error("Email sending failed:", emailError);
                res.status(500).send({ ok: false, data: "Booking confirmed, but email sending failed. Please contact us." });
            }
        } else {
            res.send({ ok: false, data: `No spaces available at ${timeslot} on ${date}!` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const deleteBooking = async (req, res) => {
    const { date, lastName, timeslot } = req.body;

    try {
        const bookingToDelete = await Bookings.findOne({ date, lastName, timeslot });
        const delBooking = await Bookings.deleteOne({ date, lastName, timeslot });

        if (delBooking.deletedCount === 0) {
            return res.status(404).send({ ok: false, data: `No booking found for ${lastName} on ${date} at ${timeslot}` });
        }

        const mailOptionsClient = {
            from: 'sarkboattrips@gmail.com',
            to: bookingToDelete.email,
            subject: 'Booking CANCELLED - Sark Boat Trips',
            html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                alt="Sark Boat Trips" width="42" height="42"
                                style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                            <h3>Dear ${bookingToDelete.firstName},</h3>
                            <p>Your booking on ${bookingToDelete.date} at ${bookingToDelete.timeslot} has been <strong
                                    style="color: lightcoral;">CANCELLED</strong>.
                            </p>
                            <p>If this is a mistake please contact us</p>
                            <p>Thank you so much,</p>
                            <h3>Sark Boat Trips</h3>
                            <hr>
                            <br>
                            <div style="text-align: center;">
                                <a style="color: white; text-decoration: none; margin: 0; padding: 0;"
                                    href="https://maps.app.goo.gl/E2XLJqrGku7eDePZ8" target='_blank'>&#9875 Creux Harbour, Sark</a>
                                <br>
                                <a style="color: white; text-decoration: none;" href="tel:+44-7911-764-246">&#9990 +44 7911 764 246</a>
                                <br>
                                <a style="color: white; text-decoration: none;" href="mailto:sarkboattrips@gmail.com">&#9993
                                    sarkboattrips@gmail.com</a>
                            </div>
                        </div>
                    </div>`,
        };

        const mailOptionsAdmin = {
            from: 'sarkboattrips@gmail.com',
            to: 'sarkboattrips@gmail.com',
            subject: `Booking CANCELLED ${bookingToDelete.date}`,
            html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                    <div
                        style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                        <h3>Booking <strong style="color: lightcoral;">CANCELLED</strong></h3>
                        <p>Name : ${bookingToDelete.firstName} ${bookingToDelete.lastName} </p>
                        <p>Date : ${bookingToDelete.date} at ${bookingToDelete.timeslot}</p>
                        <p>Email : ${bookingToDelete.email} </p>
                        <p>Phone : ${bookingToDelete.phone} </p>
                        <hr>
                        <br>
                        <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                            href="https://www.sarkboattrips.com/dashboard" target='_blank'>Go to dashboard</a>
                    </div>
                </div>`
        };

        await sendEmail(mailOptionsClient);
        await sendEmail(mailOptionsAdmin);
        res.send({ ok: true, data: `Booking for ${lastName} on ${date} at ${timeslot} deleted successfully and email sent` });

    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const checkDate = async (req, res) => {
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

const checkMonthAvail = async (req, res) => {
    const { dates } = req.body;

    try {
        const availabilityData = await Promise.all(
            dates.map(async (date) => {
                try {
                    const availability = {
                        '11am': await getAvailability(date, '11am'),
                        '2pm': await getAvailability(date, '2pm'),
                    }
                    return availability
                } catch (error) {
                    console.error(`Error fetching availability for ${date}:`, error);
                    return null;
                }
            })
        );

        res.send({ ok: true, data: availabilityData });
    } catch (error) {
        console.error("Error fetching batch availability:", error);
        res.status(500).send({ ok: false, data: "An error occurred." });
    }
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


const updateBooking = async (req, res) => {
    const updateObject = {};

    if (req.body.date) {
        updateObject.date = req.body.date;
    }
    if (req.body.timeslot) {
        updateObject.timeslot = req.body.timeslot;
    }
    if (req.body.firstName) {
        updateObject.firstName = req.body.firstName;
    }
    if (req.body.lastName) {
        updateObject.lastName = req.body.lastName;
    }
    if (req.body.phone) {
        updateObject.phone = req.body.phone;
    }
    if (req.body.adults) {
        updateObject.adults = req.body.adults;
    }
    if (req.body.children) {
        updateObject.children = req.body.children;
    }
    if (req.body.email) {
        updateObject.email = req.body.email;
    }
    if (req.body.accommodation) {
        updateObject.accommodation = req.body.accommodation;
    }
    if (req.body.message) {
        updateObject.message = req.body.message;
    }
    if (req.body.charter) {
        updateObject.charter = req.body.charter;
    }

    const bookingId = req.params.id;

    try {


        const oldBooking = await Bookings.findOne({ _id: bookingId });

        const updatedBooking = await Bookings.findOneAndUpdate(
            { _id: bookingId },
            { $set: updateObject },
            { new: true, runValidators: true }
        );

        const mailOptionsClient = {
            from: 'sarkboattrips@gmail.com',
            to: updatedBooking.email,
            subject: 'Booking UPDATED - Sark Boat Trips',
            html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                alt="Sark Boat Trips" width="42" height="42"
                                style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                            <h3>Dear ${updatedBooking.firstName},</h3>
                            <p>Your booking has been <strong style="color: aquamarine;">UPDATED</strong>.</p>
                            <p>You are booked for ${updatedBooking.adults} adults and ${updatedBooking.children} children on
                                ${updatedBooking.date} at ${updatedBooking.timeslot}</p>
                            <p>If this is a mistake please contact us</p>
                            <p>Thank you so much,</p>
                            <h3>Sark Boat Trips</h3>
                            <hr>
                            <br>
                            <div style="text-align: center;">
                                <a style="color: white; text-decoration: none; margin: 0; padding: 0;"
                                    href="https://maps.app.goo.gl/E2XLJqrGku7eDePZ8" target='_blank'>&#9875 Creux Harbour, Sark</a>
                                <br>
                                <a style="color: white; text-decoration: none;" href="tel:+44-7911-764-246">&#9990 +44 7911 764 246</a>
                                <br>
                                <a style="color: white; text-decoration: none;" href="mailto:sarkboattrips@gmail.com">&#9993
                                    sarkboattrips@gmail.com</a>
                            </div>
                        </div>
                    </div>`,
        };

        const mailOptionsAdmin = {
            from: 'sarkboattrips@gmail.com',
            to: 'sarkboattrips@gmail.com',
            subject: 'Booking UPDATED',
            html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <h3>Booking <strong style="color: aquamarine;">UPDATED</strong></h3>
                            <p>Name : ${updatedBooking.firstName} ${updatedBooking.lastName} </p>
                            <p>Date : ${updatedBooking.date} at ${updatedBooking.timeslot}</p>
                            <p>Email : ${updatedBooking.email} </p>
                            <p>Phone : ${updatedBooking.phone} </p>
                            <hr>
                            <br>
                            <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                                href="https://www.sarkboattrips.com/dashboard" target='_blank'>Go to dashboard</a>
                        </div>
                    </div>`,
        };


        if (!updatedBooking) {
            return res.status(404).send({ ok: false, data: 'Booking not found!' });
        }
        await sendEmail(mailOptionsClient);
        await sendEmail(mailOptionsAdmin);
        res.send({ ok: true, data: `Booking for ${updatedBooking.firstName} ${updatedBooking.lastName} on ${updatedBooking.date} updated successfully and email sent` });
    } catch (error) {
        res.status(500).send({ ok: false, data: "Error updating booking", error });
        console.log(error);
    }
}


module.exports = { addBooking, deleteBooking, checkDate, checkMonthAvail, search, updateBooking, updateAvailability }

