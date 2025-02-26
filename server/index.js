const express = require('express');
const app = express()
const PORT = process.env.PORT || 3030;
const stripe = require('stripe')('pk_test_51ICT0fBMZ6qJyKg9T8GPhCjR62BwTDS8DAd6ddIqvu4TfVkTTrOTI2EdXDhS469bBpivd6KxW9btqNAqCLEA9gZg00pof0nsIy');
const mongoose = require("mongoose")
const cors = require('cors');
const path = require('path');
require('dotenv').config()

const YOUR_DOMAIN = 'http://localhost:4242'



let dbPassword = process.env.atlasDB_password;

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '../client/dist')));

async function connecting() {
    try {
        await mongoose.connect(`mongodb+srv://morganguille:${dbPassword}@bookingsdb.7bty4.mongodb.net/?retryWrites=true&w=majority&appName=BookingsDB`)
        console.log('Connected to the DB')
    } catch (error) {
        console.log('ERROR: Seems like your DB is not running, please start it up !!!');
    }
}
connecting()

app.use("/bookings", require("./routes/bookings"))
app.use("/admin", require("./routes/admin"))

app.listen(PORT, () => console.log(`listening on port : ${PORT}`))

app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

app.post('/create-checkout-session', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price: `${PRICE_ID}`,
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${YOUR_DOMAIN}?success=true`,
        cancel_url: `${YOUR_DOMAIN}?canceled=true`,
    });

    res.redirect(303, session.url);
});

