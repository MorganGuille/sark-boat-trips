const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');
const STRIPEKEY = process.env.STRIPEKEY
const stripe = require('stripe')(STRIPEKEY);

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
                price: 'price_1QwO6iBMZ6qJyKg9aF2SdRu4',
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
                html: `<p>Dear ${charterData.firstName},</p>
                        <p>Your private charter on ${charterData.date} at ${charterData.timeslot} has been confirmed and deposit received. If you havnt already, please
                        get in touch so we can plan your trip!. 
                        if anything changes we'll be in touch!</p>
                        <p> Thank you so much for booking with us, Sark Boat Trips</p>`,
            };

            const mailOptionsAdmin = {
                from: 'sarkboattrips@gmail.com',
                to: 'sarkboattrips@gmail.com',
                subject: `New CHARTER on : ${date}`,
                html: `<p>A new PRIVATE CHARTER has been made by ${charterData.firstName} ${charterData.lastName} on ${charterData.date} at ${charterData.timeslot}.</p>
                        <p>Contact them by email : ${charterData.email} or phone : ${charterData.phone}`,
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