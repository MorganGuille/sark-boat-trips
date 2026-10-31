// The cancellation rules customers agree to (owner's decision, 30 Oct 2026; also on the website in
// client/src/utils/policy.js and on the /terms page: keep all three the same). Customers can cancel or change
// their party themselves up to the deadline (utils/manage.js, the manage-my-booking link); after it,
// the owner decides: cancel the booking (not charged) or leave it (charged at the trip time).
const FREE_CANCEL_HOURS = { trip: 24, charter: 48 };

const cancelRule = (charter) => {
    const what = charter ? 'charter' : 'trip';
    return `You can cancel free of charge up to ${charter ? FREE_CANCEL_HOURS.charter : FREE_CANCEL_HOURS.trip} hours before your ${what} starts.`;
};

module.exports = { FREE_CANCEL_HOURS, cancelRule };
