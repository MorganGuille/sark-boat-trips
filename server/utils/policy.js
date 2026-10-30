// The cancellation rules customers agree to (owner's decision, 30 Oct 2026; also on the website in
// client/src/utils/policy.js and on the /terms page: keep all three the same). Nothing enforces them
// in code: if a customer cancels in time the owner cancels the booking, otherwise it is left and
// the card is charged at the trip time.
const FREE_CANCEL_HOURS = { trip: 24, charter: 48 };

const cancelRule = (charter) => {
    const what = charter ? 'charter' : 'trip';
    return `You can cancel free of charge up to ${charter ? FREE_CANCEL_HOURS.charter : FREE_CANCEL_HOURS.trip} hours before your ${what} starts.`;
};

module.exports = { FREE_CANCEL_HOURS, cancelRule };
