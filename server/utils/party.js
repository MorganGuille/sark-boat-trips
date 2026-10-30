// A booking's party: adults (15 and over), children (4 to 14) and infants (3 and under, free).
// Everyone takes a seat, infants included, because the boat's limit counts every person.

const count = (value) => Number(value) || 0;

// Seats a booking uses
const seatsFor = (booking) => count(booking.adults) + count(booking.children) + count(booking.infants);

// "2 adults", "2 adults and 1 child", "1 adult, 2 children and 1 infant", for emails and messages
const partyText = (booking) => {
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const parts = [plural(count(booking.adults), 'adult', 'adults')];
    if (count(booking.children)) parts.push(plural(count(booking.children), 'child', 'children'));
    if (count(booking.infants)) parts.push(plural(count(booking.infants), 'infant', 'infants'));
    return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
};

module.exports = { seatsFor, partyText };
