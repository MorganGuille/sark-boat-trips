const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const nodemailer = require('nodemailer');
const stripe = require('stripe')('sk_test_51ICT0fBMZ6qJyKg93hNehaAWerXDMLYgGSP48Skcv4vOwpal7oayM72Pr2qLg8s8yCgnaoTN5WvxOpN5Mxqt8cf000oSAsOQmI');

const YOUR_DOMAIN = 'http://localhost:5173'

const createCheckOutSession = async (req, res) => {
    const { firstName } = req.body

    const session = await stripe.checkout.sessions.create({
        line_items: [{
            price: 'price_1QwO6iBMZ6qJyKg9aF2SdRu4',
            quantity: 1,

        }],
        mode: 'payment',
        success_url: `${YOUR_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${YOUR_DOMAIN}/cancel`,
        metadata: {
            firstName: firstName
        },
    });

    res.json({ url: session.url });
};

const verifyPayment = async (req, res) => {
    const { session_id } = req.query;
    console.log('verify payment', session_id)

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        console.log(session_id)

        if (session.payment_status === 'paid') {
            // TODO: Save booking info to database
            console.log('Payment successful for:', session.customer_email);

            res.json({ success: true, message: 'Payment verified' });
        } else {
            res.json({ success: false, message: 'Payment not completed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};



module.exports = { createCheckOutSession, verifyPayment }