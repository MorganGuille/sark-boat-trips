// The emails for a private charter. The checkout itself (saving the card, the webhook and the
// success page) is shared with ordinary trips and lives in controllers/checkout.js.
const { safeHtml } = require('../utils/safeHtml');
const { showDay } = require('../utils/dates');
const { settings } = require('../utils/settings');

const charterConfirmationEmail = (charterData, paymentLine) => ({
                from: settings.mail.sender,
                to: charterData.email,
                subject: 'PRIVATE CHARTER Confirmation Sark Boat Trips',
                html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                    alt="Sark Boat Trips" width="42" height="42"
                                    style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                                <h3>Dear ${charterData.firstName},</h3>
                                <p>Your <strong style="color: aquamarine;">private charter</strong> on ${showDay(charterData.date)} at
                                    ${charterData.timeslot} has been confirmed.</p>
                                <p>${paymentLine}</p>
                                <p>We love to run unique charters, so if you haven't already, please get in touch so we can plan your trip!</p>
                                <p><a style="color: white; text-decoration: none;" href="mailto:${settings.mail.from}">&#9993
                                        ${settings.mail.from}</a></p>
                                <p>If your plans change or you need to cancel your charter, please let us know asap</p>
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
                                    <a style="color: white; text-decoration: none;" href="mailto:${settings.mail.from}">&#9993
                                        ${settings.mail.from}</a>
                                </div>
                            </div>
                        </div>`,
            });

const charterAdminEmail = (charterData) => ({
                from: settings.mail.sender,
                to: settings.mail.owner,
                subject: `New CHARTER on : ${showDay(charterData.date)}`,
                html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <h3>New PRIVATE CHARTER ${showDay(charterData.date)}</h3>
                                <p>Name: ${charterData.firstName} ${charterData.lastName}</p>
                                <p>Date: ${charterData.timeslot} ${showDay(charterData.date)}.</p>
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
                                    href="${settings.dashboardUrl}" target='_blank'>Go to dashboard</a>
                            </div>
                        </div>`,
            });

module.exports = { charterConfirmationEmail, charterAdminEmail };
