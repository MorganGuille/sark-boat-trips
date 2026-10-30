const mongoose = require('mongoose');
const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');
const { getAvailability, isSlotEmpty } = require('../utils/availability');
const { safeHtml } = require('../utils/safeHtml');
const { settings } = require('../utils/settings');
const { isDay, showDay } = require('../utils/dates');
const { readPrices, bookingValue } = require('../utils/prices');
const { isMonth, monthRange, buildReport, toCsv } = require('../utils/report');
const { validatePublicBooking, validateAdminBooking, validateAvailabilitySetting } = require('../utils/validateBooking');


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

// For emails sent after a booking change has already been saved: a failed email is reported
// (true or false) and logged by sendEmail, but never undoes or hides the saved change.
const trySend = async (mailOptions) => {
    try {
        await sendEmail(mailOptions);
        return true;
    } catch {
        return false;
    }
};

const updateAvailability = async (req, res) => {
    const { date, timeslot, capacity } = req.body;

    const problem = validateAvailabilitySetting(req.body);
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }

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


const isBlank = (value) => value == null || String(value).trim() === '';

const bookingName = (booking) => [booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'this booking';

// What each booking is worth (pence, or null if no prices are known), so the dashboard can show what to collect
const withAmountDue = (bookings, prices) => bookings.map((b) => ({ ...b.toObject(), amountDue: bookingValue(b, prices) }));

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;

// Day view and search hide cancelled bookings unless asked (?includeCancelled=true)
const statusFilter = (req) => req.query.includeCancelled === 'true' ? {} : { status: { $ne: 'cancelled' } };

const buildConfirmationEmail = ({ email, firstName, adults, childResponse, date, timeslot }) => ({
                from: 'sarkboattrips@gmail.com',
                to: email,
                subject: 'Booking Confirmation Sark Boat Trips',
                html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                <div style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                        alt="Sark Boat Trips" width="42" height="42"
                        style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                <h3>Dear ${firstName},</h3>
                <p>Your booking for ${adults} adults ${childResponse} on ${showDay(date)} at ${timeslot} has been confirmed.</p>
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

    const problem = await validatePublicBooking(req.body);
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }

    try {

        const availability = await getAvailability(date, timeslot);

        if (availability >= (Number(adults) + Number(children))) {

            const mailOptionsClient = buildConfirmationEmail({ email, firstName, adults, childResponse, date, timeslot });

            const mailOptionsAdmin = {
                from: 'sarkboattrips@gmail.com',
                to: 'sarkboattrips@gmail.com',
                subject: `New Booking ${showDay(date)}`,
                html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <h3>New Booking ${showDay(date)}</h3>
                                <p>A new booking has been made by:</p>
                                <p><strong>${firstName} ${lastName}</strong></p>
                                <p>for ${adults} adults ${childResponse}</p>
                                <p>on ${showDay(date)} at ${timeslot}.</p>
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
                                    href="${settings.dashboardUrl}" target='_blank'>Go to dashboard</a>
                            </div>
                        </div>`,
            };
            // Save first: the booking must exist even if an email can't be sent
            // Only these details come from the customer. Status, booking type (charter), payment
            // fields and prices are never theirs to choose: the prices are the ones in force right now.
            await Bookings.create({
                date, timeslot, firstName, lastName, phone, email, adults, children, accommodation, message,
                prices: (await readPrices()) || undefined,
            });

            const confirmationSent = await trySend(mailOptionsClient);
            if (!confirmationSent) mailOptionsAdmin.subject += ' (CUSTOMER EMAIL FAILED, please contact them)';
            await trySend(mailOptionsAdmin);

            const party = `${adults} adults${childResponse ? ` ${childResponse}` : ''}`;
            const reserved = `Thanks ${firstName}, your booking for ${party} on ${showDay(date)} at ${timeslot} has been reserved.`;
            res.send({
                ok: true,
                data: confirmationSent
                    ? `${reserved} Please check your email for confirmation (Dont forget to check the spam folder!)`
                    : `${reserved} However, we couldn't send your confirmation email, so please make a note of these details and contact us if you have any questions.`,
            });
        } else {
            res.send({ ok: false, data: `No spaces available at ${timeslot} on ${showDay(date)}!` });
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

    const problem = validateAdminBooking(req.body, { requireTrip: true });
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }

    try {
        const availability = await getAvailability(date, timeslot);
        if (availability < adults + children) {
            return res.send({ ok: false, data: `No spaces available at ${timeslot} on ${showDay(date)}!` });
        }

        // validateBeforeSave is off because the model requires the customer details
        await new Bookings({
            date, timeslot, firstName, lastName, phone, email, adults, children, accommodation, message, charter,
            prices: (await readPrices()) || undefined,
        }).save({ validateBeforeSave: false });

        const who = [firstName, lastName].filter(Boolean).join(' ') || 'the booking';
        if (email) {
            const sent = await trySend(buildConfirmationEmail({
                email, firstName: firstName || 'guest', adults, childResponse: children > 0 ? `and ${children} children` : '', date, timeslot,
            }));
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(date)} at ${timeslot} saved${sent ? ' and confirmation email sent' : ', but the confirmation email could not be sent'}` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${showDay(date)} at ${timeslot} saved (no email address, so no confirmation was sent)` });
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
            html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                alt="Sark Boat Trips" width="42" height="42"
                                style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                            <h3>Dear ${cancelledBooking.firstName},</h3>
                            <p>Your booking on ${showDay(cancelledBooking.date)} at ${cancelledBooking.timeslot} has been <strong
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
            subject: `Booking CANCELLED ${showDay(cancelledBooking.date)}`,
            html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                    <div
                        style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                        <h3>Booking <strong style="color: lightcoral;">CANCELLED</strong></h3>
                        <p>Name : ${cancelledBooking.firstName} ${cancelledBooking.lastName} </p>
                        <p>Date : ${showDay(cancelledBooking.date)} at ${cancelledBooking.timeslot}</p>
                        <p>Email : ${cancelledBooking.email} </p>
                        <p>Phone : ${cancelledBooking.phone} </p>
                        <hr>
                        <br>
                        <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                            href="${settings.dashboardUrl}" target='_blank'>Go to dashboard</a>
                    </div>
                </div>`
        };

        const who = bookingName(cancelledBooking);
        try {
            if (cancelledBooking.email) await sendEmail(mailOptionsClient);
            await sendEmail(mailOptionsAdmin);
        } catch (emailError) {
            // The booking is already cancelled, so report that and flag the email problem
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(cancelledBooking.date)} at ${cancelledBooking.timeslot} cancelled, but the email could not be sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${showDay(cancelledBooking.date)} at ${cancelledBooking.timeslot} cancelled${cancelledBooking.email ? ' and email sent' : ''}` });

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
            return res.send({ ok: false, data: `Can't restore this charter: the ${booking.timeslot} trip on ${showDay(booking.date)} already has other bookings (or is closed).` });
        }

        const availability = await getAvailability(booking.date, booking.timeslot);
        if (availability < adults + children) {
            return res.send({ ok: false, data: `Can't restore: only ${availability} spaces left at ${booking.timeslot} on ${showDay(booking.date)}.` });
        }

        booking.status = 'active';
        booking.cancelledAt = undefined;
        // validateBeforeSave is off because bookings made on the dashboard may be incomplete
        await booking.save({ validateBeforeSave: false });

        const who = bookingName(booking);
        if (!booking.email) {
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(booking.date)} at ${booking.timeslot} restored (no email address, so no confirmation was sent)` });
        }
        try {
            await sendEmail(buildConfirmationEmail({
                email: booking.email, firstName: booking.firstName || 'guest', adults, childResponse: children > 0 ? `and ${children} children` : '', date: booking.date, timeslot: booking.timeslot,
            }));
        } catch (emailError) {
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(booking.date)} at ${booking.timeslot} restored, but the confirmation email could not be sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${showDay(booking.date)} at ${booking.timeslot} restored and confirmation email sent` });
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
        res.send({ ok: true, data: `Booking for ${bookingName(deleted)} on ${showDay(deleted.date)} at ${deleted.timeslot} permanently deleted` });
    } catch (error) {
        console.error("Error permanently deleting booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const checkDate = async (req, res) => {
    let date = req.params.date
    if (!isDay(date)) {
        return res.status(400).send({ ok: false, data: "Invalid date." })
    }
    try {

        let bookings = await Bookings.find({ date: date, ...statusFilter(req) })
        res.send({ ok: true, data: withAmountDue(bookings, await readPrices()) })
    }
    catch (error) {
        res.send({ ok: false, data: "check console for errors" })
        console.log(error)
    }
}

const checkMonthAvail = async (req, res) => {
    const { dates } = req.body;

    // The calendar asks for one month (at most 31 days) at a time
    const valid = Array.isArray(dates) && dates.length > 0 && dates.length <= 31 &&
        dates.every(isDay);
    if (!valid) {
        return res.status(400).send({ ok: false, data: "Invalid dates." });
    }

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
                    console.error(`Error fetching availability for ${showDay(date)}:`, error);
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
        res.send({ ok: true, data: withAmountDue(bookings, await readPrices()) });
    } catch (error) {
        console.error("Error searching bookings:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};


const updatedBookingClientEmail = (booking) => ({
            from: 'sarkboattrips@gmail.com',
            to: booking.email,
            subject: 'Booking UPDATED - Sark Boat Trips',
            html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                alt="Sark Boat Trips" width="42" height="42"
                                style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                            <h3>Dear ${booking.firstName || 'guest'},</h3>
                            <p>Your booking has been <strong style="color: aquamarine;">UPDATED</strong>.</p>
                            <p>You are booked for ${Number(booking.adults) || 0} adults and ${Number(booking.children) || 0} children on
                                ${showDay(booking.date)} at ${booking.timeslot}</p>
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
        });

const updatedBookingAdminEmail = (booking) => ({
            from: 'sarkboattrips@gmail.com',
            to: 'sarkboattrips@gmail.com',
            subject: 'Booking UPDATED',
            html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                        <div
                            style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                            <h3>Booking <strong style="color: aquamarine;">UPDATED</strong></h3>
                            <p>Name : ${[booking.firstName, booking.lastName].filter(Boolean).join(' ') || '(no name)'} </p>
                            <p>Date : ${showDay(booking.date)} at ${booking.timeslot}</p>
                            <p>Email : ${booking.email || '(none)'} </p>
                            <p>Phone : ${booking.phone || '(none)'} </p>
                            <hr>
                            <br>
                            <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                                href="${settings.dashboardUrl}" target='_blank'>Go to dashboard</a>
                        </div>
                    </div>`,
        });

// Text details the dashboard can edit. Sent empty, one is cleared; left out, it stays as it is.
const EDITABLE_TEXT = ['firstName', 'lastName', 'phone', 'email', 'accommodation', 'message'];

const seatsIn = (booking) => (Number(booking.adults) || 0) + (Number(booking.children) || 0);

const updateBooking = async (req, res) => {
    const problem = validateAdminBooking(req.body);
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }

    const { id } = req.params;
    const booking = mongoose.isValidObjectId(id) ? await Bookings.findById(id) : null;
    if (!booking) {
        return res.status(404).send({ ok: false, data: 'Booking not found!' });
    }
    if (booking.status === 'cancelled') {
        return res.status(409).send({ ok: false, data: 'This booking is cancelled. Restore it before editing.' });
    }

    const before = { date: booking.date, timeslot: booking.timeslot, seats: seatsIn(booking), charter: booking.charter };

    // The date, timeslot and booking type can be changed but never blanked
    for (const key of ['date', 'timeslot', 'charter']) {
        if (!isBlank(req.body[key])) booking[key] = req.body[key];
    }
    for (const key of EDITABLE_TEXT) {
        if (req.body[key] !== undefined) booking[key] = isBlank(req.body[key]) ? undefined : req.body[key].trim();
    }
    // Party size drives the seat counts, so a blank adults box leaves the number alone rather than
    // silently freeing the seats. A blank children box means no children.
    if (!isBlank(req.body.adults)) booking.adults = Number(req.body.adults);
    if (req.body.children !== undefined) booking.children = isBlank(req.body.children) ? 0 : Number(req.body.children);

    if (!booking.isModified()) {
        return res.send({ ok: true, data: 'No changes to save.' });
    }

    // Moving a booking, adding people, or making it a charter must still fit. (Taking people away
    // or editing contact details never needs room, so a trip that is already over-full can still be edited.)
    const needsRoom = booking.date !== before.date || booking.timeslot !== before.timeslot ||
        seatsIn(booking) > before.seats || (booking.charter === 'true' && before.charter !== 'true');
    if (needsRoom) {
        const trip = `the ${booking.timeslot} trip on ${showDay(booking.date)}`;
        if (booking.charter === 'true') {
            if (!(await isSlotEmpty(booking.date, booking.timeslot, booking._id))) {
                return res.send({ ok: false, data: `Can't make that change: ${trip} already has other bookings (or is closed), and a charter needs the whole trip.` });
            }
        } else {
            const left = await getAvailability(booking.date, booking.timeslot, booking._id);
            if (left < seatsIn(booking)) {
                return res.send({ ok: false, data: `Can't make that change: ${trip} has only ${Math.max(left, 0)} space${left === 1 ? '' : 's'} left. Raise the trip's capacity first if you want to fit more people in.` });
            }
        }
    }

    // validateBeforeSave is off because bookings made on the dashboard may be missing details
    await booking.save({ validateBeforeSave: false });

    // The change is saved, so email problems are reported but never fail the request
    const notify = req.body.notifyCustomer !== false;
    const customerEmailed = booking.email && notify ? await trySend(updatedBookingClientEmail(booking)) : null;
    await trySend(updatedBookingAdminEmail(booking));

    let emailNote = '';
    if (booking.email && !notify) emailNote = ' (customer not emailed, as you asked)';
    else if (customerEmailed === true) emailNote = ' and email sent';
    else if (customerEmailed === false) emailNote = ', but the email to the customer could not be sent';
    res.send({ ok: true, data: `Booking for ${bookingName(booking)} on ${showDay(booking.date)} updated successfully${emailNote}` });
};

// Passenger and income totals for one month (?format=csv for a download). Dashboard only.
const monthlyReport = async (req, res) => {
    const { month } = req.params;
    if (!isMonth(month)) {
        return res.status(400).send({ ok: false, data: "Please choose a month." });
    }
    const { first, last } = monthRange(month);
    const bookings = await Bookings.find({ date: { $gte: first, $lte: last }, status: { $ne: 'cancelled' } });
    const report = buildReport(bookings, await readPrices());
    if (!report) {
        return res.status(409).send({ ok: false, data: "Set your adult, child and charter prices first, so the income can be worked out." });
    }
    if (req.query.format === 'csv') {
        res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="sark-boat-trips-${month}.csv"` });
        return res.send(toCsv(report));
    }
    res.send({ ok: true, month, days: report.days, total: report.total });
};

// The owner took the money on the day (cash or card reader). Also stops a saved card being charged.
const markPaid = async (req, res) => {
    const { _id } = req.body;
    if (!mongoose.isValidObjectId(_id)) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    const booking = await Bookings.findById(_id);
    if (!booking) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    if (booking.status === 'cancelled') return res.status(409).send({ ok: false, data: 'This booking is cancelled. Restore it before marking it paid.' });

    const amount = bookingValue(booking, await readPrices());
    // Only from unpaid or card saved, and in one step, so it can't race the card charge
    const updated = await Bookings.findOneAndUpdate(
        { _id, paymentStatus: { $in: ['unpaid', 'card_saved', null] } },
        { $set: { paymentStatus: 'paid_in_person', paidAt: new Date(), ...(amount !== null && { amountPaid: amount }) }, $unset: { paymentNote: '' } },
        { new: true }
    );
    if (!updated) {
        const now = booking.paymentStatus === 'charging' ? 'is being charged right now' : 'is already paid';
        return res.status(409).send({ ok: false, data: `This booking ${now}.` });
    }
    res.send({ ok: true, data: `${bookingName(updated)} on ${showDay(updated.date)} at ${updated.timeslot} marked as paid in person${amount !== null ? ` (${pounds(amount)})` : ''}` });
};

// Undoes "Mark paid" (a mis-tap). A booking with a saved card goes back to being charged at the trip time.
const markUnpaid = async (req, res) => {
    const { _id } = req.body;
    if (!mongoose.isValidObjectId(_id)) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    const booking = await Bookings.findById(_id);
    if (!booking) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    if (booking.paymentStatus !== 'paid_in_person') {
        const why = booking.paymentStatus === 'paid' ? 'It was paid online: refund it in Stripe instead.' : 'It is not marked as paid in person.';
        return res.status(409).send({ ok: false, data: `Can't undo: ${why}` });
    }
    const back = booking.stripePaymentMethodId ? 'card_saved' : 'unpaid';
    const updated = await Bookings.findOneAndUpdate(
        { _id, paymentStatus: 'paid_in_person' },
        { $set: { paymentStatus: back }, $unset: { paidAt: '', amountPaid: '' } },
        { new: true }
    );
    if (!updated) return res.status(409).send({ ok: false, data: 'This booking changed in the meantime. Try again.' });
    res.send({ ok: true, data: `${bookingName(updated)} on ${showDay(updated.date)} at ${updated.timeslot} is ${back === 'card_saved' ? 'back to being charged to the saved card at the trip time' : 'marked as unpaid again'}` });
};

module.exports = { markPaid, markUnpaid, monthlyReport, addBooking, adminAddBooking, cancelBooking, restoreBooking, permanentlyDeleteBooking, checkDate, checkMonthAvail, search, updateBooking, updateAvailability }

