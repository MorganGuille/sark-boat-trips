// Customer data tools for the dashboard (spec P2-13): see utils/customerData.js for the rules
const { tidyEmail, isEmail, find, eraseProblem, summary, erase } = require('../utils/customerData');
const { guernseyToday } = require('../utils/validateBooking');

const emailFrom = (value) => (isEmail(value) ? tidyEmail(value) : null);

// GET /customers?email=...: everything held for that address, and whether it can be erased now
const show = async (req, res) => {
    const email = emailFrom(req.query.email);
    if (!email) return res.status(400).send({ ok: false, data: 'Type the customer\'s email address.' });
    const found = await find(email);
    res.send({ ok: true, email, ...(await summary(found)), eraseProblem: eraseProblem(found, email) });
};

// GET /customers/export?email=...: the same, as a file to send the customer
const download = async (req, res) => {
    const email = emailFrom(req.query.email);
    if (!email) return res.status(400).send({ ok: false, data: 'Type the customer\'s email address.' });
    const data = { email, exportedOn: guernseyToday(), from: 'Sark Boat Trips', ...(await summary(await find(email))) };
    res.set('Content-Disposition', `attachment; filename="sark-boat-trips-${email.replace(/[^a-z0-9.@_-]/g, '_')}.json"`);
    res.type('application/json').send(JSON.stringify(data, null, 2));
};

// POST /customers/erase { email, confirm }: confirm is the address typed again, so it can't be done by a slip
const eraseCustomer = async (req, res) => {
    const email = emailFrom(req.body.email);
    if (!email) return res.status(400).send({ ok: false, data: 'Type the customer\'s email address.' });
    if (tidyEmail(req.body.confirm) !== email) return res.status(400).send({ ok: false, data: 'Type the email address again to confirm.' });
    const found = await find(email);
    if (!found.bookings.length && !found.vouchers.length) return res.status(404).send({ ok: false, data: `Nothing is held for ${email}.` });
    const problem = eraseProblem(found, email);
    if (problem) return res.status(409).send({ ok: false, data: problem });
    const result = await erase(email, found);
    if (!result.ok) return res.status(503).send({ ok: false, data: result.problem });
    const parts = [
        result.bookings ? `${result.bookings} booking${result.bookings === 1 ? '' : 's'}` : null,
        result.vouchers ? `${result.vouchers} gift voucher${result.vouchers === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' and ');
    const card = result.cards ? (result.stripeNote ? '' : ' Their saved card was removed at Stripe.') : '';
    res.send({ ok: true, data: `Erased ${email} from ${parts}. Dates, party sizes and amounts are kept for your reports.${card}${result.stripeNote ? ` ${result.stripeNote}` : ''}` });
};

module.exports = { show, download, eraseCustomer };
