const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');

const stripe = require('stripe')(process.env.STRIPEKEY);

const YOUR_DOMAIN = 'https://secret-eyrie-44762-a52d7fb9dbaa.herokuapp.com'
// const YOUR_DOMAIN = 'http://localhost:5173'

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

// ----------------


const createCheckOutSession = async (req, res) => {
    const { ...newBooking } = req.body

    /// check for availability before sending to stripe ////

    const availability = await getAvailability(newBooking.date, newBooking.timeslot);

    if (availability === 12) {

        const session = await stripe.checkout.sessions.create({
            line_items: [{
                price: 'price_1QzL9TBMZ6qJyKg9hrBauqD6',
                quantity: 1,

            }],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${YOUR_DOMAIN}/canceled`,
            metadata: {
                timeslot: newBooking.timeslot,
                firstName: newBooking.firstName,
                lastName: newBooking.lastName,
                email: newBooking.email,
                phone: newBooking.phone,
                adults: newBooking.adults,
                children: newBooking.children,
                date: newBooking.date,
                accommodation: newBooking.accommodation,
                message: newBooking.message,
                charter: newBooking.charter,
            },
        });

        res.json({ url: session.url });
    } else { res.send({ ok: false, data: `No spaces available at ${newBooking.timeslot} on ${newBooking.date}!` }); }


};

const verifyPayment = async (req, res) => {
    let { session_id } = req.query;
    console.log('verifying payment for session id:', session_id)
    try {
        ///// get session from stripe ////
        const session = await stripe.checkout.sessions.retrieve(session_id);
        let { ...charterData } = session.metadata
        let date = session.metadata.date
        let timeslot = session.metadata.timeslot
        let email = session.metadata.email

        const availability = await getAvailability(charterData.date, charterData.timeslot);

        if (availability != 12) {
            return res.json({ ok: false, message: 'No availability ', date: charterData.date, name: charterData.firstName });

        }

        if (session.payment_status === 'paid') {

            ///// if payment was successful, create booking ////
            let newBooking = await Bookings.create(charterData);
            console.log('Booking successful for:', charterData);

            //// and update capacity of that timeslot to 0 ////
            let totalpax = (Number(charterData.adults) + Number(charterData.children))
            // let delta = 12 - totalpax

            let newCapacity = await Availability.findOneAndUpdate(

                { date, timeslot },
                { capacity: totalpax },
                { upsert: true, new: true }
            );
            const mailOptionsClient = {
                from: 'sarkboattrips@gmail.com',
                to: email,
                subject: 'PRIVATE CHARTER Confirmation Sark Boat Trips',
                html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto auto auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                    alt="Sark Boat Trips" width="42" height="42"
                                    style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                                <h3>Dear ${charterData.firstName},</h3>
                                <p>Your <strong style="color: aquamarine;">private charter</strong> on ${charterData.date} at
                                    ${charterData.timeslot} has been confirmed and we've received your deposit</p>
                                <p>We love to run unique charters, so if you haven't already, please get in touch so we can plan your trip!</p>
                                <p><a style="color: white; text-decoration: none;" href="mailto:sarkboattrips@gmail.com">&#9993
                                        sarkboattrips@gmail.com</a></p>
                                <p>If your plans change or you need to cancel your charter, please let us know asap</p>
                                <p>We try to be as flexible as we can and just to note that your deposit <strong>is refundable</strong> if we
                                    need to cancel, for example, due
                                    to the weather.</p>
                                <br>
                                <p> Thank you so much for booking with us,</p>
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
                subject: `New CHARTER on : ${date}`,
                html: `<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto auto auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <h3>New PRIVATE CHARTER ${charterData.date}</h3>
                                <p>Name: ${charterData.firstName} ${charterData.lastName}</p>
                                <p>Date: ${charterData.timeslot} ${charterData.date}.</p>
                                <hr>
                                <p>Message:</p>
                                <p>${charterData.message}</p>
                                <hr>
                                <p>Email : ${charterData.email}</p>
                                <p>Phone : ${charterData.phone}</p>
                                <p>Accommodation : ${charterData.accommodation}</p>
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

            } catch (emailError) {
                console.error("Email sending failed:", emailError);
                res.status(500).json({ ok: false, data: "Booking confirmed, but email sending failed. Please contact us." });
            }

            res.json({ ok: true, message: 'Payment verified and charter added', date: charterData.date, name: charterData.firstName });

        } else if ((session.payment_status === 'unpaid')) {
            res.json({ ok: false, message: 'Payment not completed', date: charterData.date, name: charterData.firstName });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ ok: false, message: 'Internal Server Error' });
    }
};



module.exports = { createCheckOutSession, verifyPayment }