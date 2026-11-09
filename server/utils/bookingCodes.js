// The two codes every booking gets (spec P2-6). manageToken: the long random part of the customer's
// "manage my booking" link, which is all it takes to open their booking, so it must be unguessable.
// reference: a short code (SBT-7K3F9Q) customers can quote on the phone, shown in emails and on the
// dashboard. Both are made when a booking is created (models/bookings.js), and for older bookings
// the first time an email is built for them (utils/manage.js).
const crypto = require('crypto');

const REFERENCE_LETTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out on the phone

const newManageToken = () => crypto.randomBytes(24).toString('base64url'); // 32 characters
const newReference = () => `SBT-${Array.from(crypto.randomBytes(6), (byte) => REFERENCE_LETTERS[byte % REFERENCE_LETTERS.length]).join('')}`;
const isManageToken = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);

// A reference no other booking has. Two bookings drawing the same one is very unlikely (887 million
// codes), but the owner uses a gift voucher by typing the reference, so it must only ever mean one
// booking. isTaken(reference) asks the database.
const unusedReference = async (isTaken) => {
    for (let attempt = 1; ; attempt++) {
        const reference = newReference();
        if (attempt >= 10 || !(await isTaken(reference))) return reference;
    }
};

module.exports = { newManageToken, newReference, unusedReference, isManageToken };
