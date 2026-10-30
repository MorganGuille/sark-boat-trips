// Sends email through Gmail (see spec P2-10: to be replaced by a proper email service).
// The tests replace nodemailer before this file is loaded, so nothing real is ever sent there.
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.gmail_address,
        pass: process.env.gmail_password,
    },
});

// Throws if the email can't be sent: only use it where nothing has been saved yet
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

// For emails sent after a change has already been saved: a failed email is reported (true or
// false) and logged, but never undoes or hides the saved change.
const trySend = async (mailOptions) => {
    try {
        await sendEmail(mailOptions);
        return true;
    } catch {
        return false;
    }
};

module.exports = { sendEmail, trySend };
