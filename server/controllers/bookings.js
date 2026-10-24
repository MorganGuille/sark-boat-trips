const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');
const { getAvailability, isSlotEmpty } = require('../utils/availability');


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


const bookingName = (booking) => [booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'this booking';

// Day view and search hide cancelled bookings unless asked (?includeCancelled=true)
const statusFilter = (req) => req.query.includeCancelled === 'true' ? {} : { status: { $ne: 'cancelled' } };

// Public bookings must include everything we need to contact the customer
const isCompleteBooking = (booking) =>
    ['date', 'timeslot', 'firstName', 'lastName', 'phone', 'email']
        .every((key) => typeof booking[key] === 'string' && booking[key].trim()) &&
    Number(booking.adults) >= 1;

const buildConfirmationEmail = ({ email, firstName, adults, childResponse, date, timeslot }) => ({
                from: 'sarkboattrips@gmail.com',
                to: email,
                subject: 'Booking Confirmation Sark Boat Trips',
                html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                <div style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                        alt="Sark Boat Trips" width="42" height="42"
                        style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                <h3>Dear ${firstName},</h3>
                <p>Your booking for ${adults} adults ${childResponse} on ${date} at ${timeslot} has been confirmed.</p>
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
            });

const addBooking = async (req, res) => {
    let { date, firstName, lastName, phone, adults, children = 0, email, timeslot, message, accommodation } = req.body;
    let childResponse = ``
    Number(children) > 0 ? childResponse = `and ${children} children` : childResponse = ``

    if (!isCompleteBooking(req.body)) {
        return res.status(400).send({ ok: false, data: "Please fill in all the required fields." });
    }

    try {

        const availability = await getAvailability(date, timeslot);

        if (availability >= (Number(adults) + Number(children))) {

            const mailOptionsClient = buildConfirmationEmail({ email, firstName, adults, childResponse, date, timeslot });

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
                                <p>for ${adults} adults ${childResponse}</p>
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
                const { status, cancelledAt, ...bookingData } = req.body;
                let newBooking = await Bookings.create(bookingData);
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

// Dashboard only (behind requireAuth): the owner may need to save a booking with missing details
const adminAddBooking = async (req, res) => {
    const { date, timeslot, firstName, lastName, phone, email, accommodation, message, charter } = req.body;
    const adults = Number(req.body.adults) || 0;
    const children = Number(req.body.children) || 0;

    if (!date || !timeslot) {
        return res.status(400).send({ ok: false, data: "A date and timeslot are required." });
    }

    try {
        const availability = await getAvailability(date, timeslot);
        if (availability < adults + children) {
            return res.send({ ok: false, data: `No spaces available at ${timeslot} on ${date}!` });
        }

        // validateBeforeSave is off because the model requires the customer details
        await new Bookings({
            date, timeslot, firstName, lastName, phone, email, adults, children, accommodation, message, charter,
        }).save({ validateBeforeSave: false });

        const who = [firstName, lastName].filter(Boolean).join(' ') || 'the booking';
        if (email) {
            await sendEmail(buildConfirmationEmail({
                email, firstName: firstName || 'guest', adults, childResponse: children > 0 ? `and ${children} children` : '', date, timeslot,
            }));
            return res.send({ ok: true, data: `Booking for ${who} on ${date} at ${timeslot} saved and confirmation email sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${date} at ${timeslot} saved (no email address, so no confirmation was sent)` });
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "An error occurred saving the booking." });
    }
};

const cancelBooking = async (req, res) => {
    const { _id } = req.body;

    try {
        const cancelledBooking = await Bookings.findOneAndUpdate(
            { _id, status: { $ne: 'cancelled' } },
            { $set: { status: 'cancelled', cancelledAt: new Date() } },
            { new: true }
        );

        if (!cancelledBooking) {
            return res.status(404).send({ ok: false, data: `No active booking found for booking ID : ${_id}` });
        }

        const mailOptionsClient = {
            from: 'sarkboattrips@gmail.com',
            to: cancelledBooking.email,
            subject: 'Booking CANCELLED - Sark Boat Trips',
            html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                alt="Sark Boat Trips" width="42" height="42"
                                style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                            <h3>Dear ${cancelledBooking.firstName},</h3>
                            <p>Your booking on ${cancelledBooking.date} at ${cancelledBooking.timeslot} has been <strong
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
            subject: `Booking CANCELLED ${cancelledBooking.date}`,
            html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                    <div
                        style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                        <h3>Booking <strong style="color: lightcoral;">CANCELLED</strong></h3>
                        <p>Name : ${cancelledBooking.firstName} ${cancelledBooking.lastName} </p>
                        <p>Date : ${cancelledBooking.date} at ${cancelledBooking.timeslot}</p>
                        <p>Email : ${cancelledBooking.email} </p>
                        <p>Phone : ${cancelledBooking.phone} </p>
                        <hr>
                        <br>
                        <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                            href="https://www.sarkboattrips.com/dashboard" target='_blank'>Go to dashboard</a>
                    </div>
                </div>`
        };

        const who = bookingName(cancelledBooking);
        try {
            if (cancelledBooking.email) await sendEmail(mailOptionsClient);
            await sendEmail(mailOptionsAdmin);
        } catch (emailError) {
            // The booking is already cancelled, so report that and flag the email problem
            return res.send({ ok: true, data: `Booking for ${who} on ${cancelledBooking.date} at ${cancelledBooking.timeslot} cancelled, but the email could not be sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${cancelledBooking.date} at ${cancelledBooking.timeslot} cancelled${cancelledBooking.email ? ' and email sent' : ''}` });

    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const restoreBooking = async (req, res) => {
    const { _id } = req.body;

    try {
        const booking = await Bookings.findOne({ _id, status: 'cancelled' });
        if (!booking) {
            return res.status(404).send({ ok: false, data: "No cancelled booking found with that ID." });
        }

        const adults = Number(booking.adults) || 0;
        const children = Number(booking.children) || 0;

        if (booking.charter === 'true' && !(await isSlotEmpty(booking.date, booking.timeslot))) {
            return res.send({ ok: false, data: `Can't restore this charter: the ${booking.timeslot} trip on ${booking.date} already has other bookings (or is closed).` });
        }

        const availability = await getAvailability(booking.date, booking.timeslot);
        if (availability < adults + children) {
            return res.send({ ok: false, data: `Can't restore: only ${availability} spaces left at ${booking.timeslot} on ${booking.date}.` });
        }

        booking.status = 'active';
        booking.cancelledAt = undefined;
        // validateBeforeSave is off because bookings made on the dashboard may be incomplete
        await booking.save({ validateBeforeSave: false });

        const who = bookingName(booking);
        if (!booking.email) {
            return res.send({ ok: true, data: `Booking for ${who} on ${booking.date} at ${booking.timeslot} restored (no email address, so no confirmation was sent)` });
        }
        try {
            await sendEmail(buildConfirmationEmail({
                email: booking.email, firstName: booking.firstName || 'guest', adults, childResponse: children > 0 ? `and ${children} children` : '', date: booking.date, timeslot: booking.timeslot,
            }));
        } catch (emailError) {
            return res.send({ ok: true, data: `Booking for ${who} on ${booking.date} at ${booking.timeslot} restored, but the confirmation email could not be sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${booking.date} at ${booking.timeslot} restored and confirmation email sent` });
    } catch (error) {
        console.error("Error restoring booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

// Only cancelled bookings can be removed for good, e.g. when a customer asks for their data to be erased
const permanentlyDeleteBooking = async (req, res) => {
    const { _id } = req.body;

    try {
        const deleted = await Bookings.findOneAndDelete({ _id, status: 'cancelled' });
        if (!deleted) {
            return res.status(404).send({ ok: false, data: "Only cancelled bookings can be permanently deleted." });
        }
        res.send({ ok: true, data: `Booking for ${bookingName(deleted)} on ${deleted.date} at ${deleted.timeslot} permanently deleted` });
    } catch (error) {
        console.error("Error permanently deleting booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const checkDate = async (req, res) => {
    let date = req.params.date
    try {

        let bookings = await Bookings.find({ date: date, ...statusFilter(req) })
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
        let bookings = await Bookings.find({ lastName: { $regex: search, $options: 'i' }, ...statusFilter(req) });
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
        if (oldBooking && oldBooking.status === 'cancelled') {
            return res.status(409).send({ ok: false, data: 'This booking is cancelled. Restore it before editing.' });
        }

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
        if (updatedBooking.email) await sendEmail(mailOptionsClient);
        await sendEmail(mailOptionsAdmin);
        res.send({ ok: true, data: `Booking for ${[updatedBooking.firstName, updatedBooking.lastName].filter(Boolean).join(' ') || 'this booking'} on ${updatedBooking.date} updated successfully${updatedBooking.email ? ' and email sent' : ''}` });
    } catch (error) {
        res.status(500).send({ ok: false, data: "Error updating booking", error });
        console.log(error);
    }
}


module.exports = { addBooking, adminAddBooking, cancelBooking, restoreBooking, permanentlyDeleteBooking, checkDate, checkMonthAvail, search, updateBooking, updateAvailability }

