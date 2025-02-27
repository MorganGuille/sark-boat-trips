const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');
const stripe = require('stripe')('sk_test_51ICT0fBMZ6qJyKg93hNehaAWerXDMLYgGSP48Skcv4vOwpal7oayM72Pr2qLg8s8yCgnaoTN5WvxOpN5Mxqt8cf000oSAsOQmI');

const YOUR_DOMAIN = 'http://localhost:5173'

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
            cancel_url: `${YOUR_DOMAIN}/cancel`,
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

        if (session.payment_status === 'paid') {
            ///// if payment was successful, create booking ////
            let newBooking = await Bookings.create(charterData);
            console.log('Booking successful for:', charterData);

            //// and update capacity of that timeslot to 0 ////
            let totalpax = (Number(charterData.adults) + Number(charterData.children)) /// 5 ////
            let delta = 12 - totalpax  /// 7 //// 

            let newCapacity = await Availability.findOneAndUpdate(

                { date, timeslot },
                { $inc: { capacity: - delta } },
                { upsert: true, new: true }
            );
            console.log('availability data: ', newCapacity.capacity)

            res.json({ success: true, message: 'Payment verified and charter added' });

        } else {
            res.json({ success: false, message: 'Payment not completed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};



module.exports = { createCheckOutSession, verifyPayment }