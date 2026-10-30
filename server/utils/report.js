// The monthly passenger and income report. One row per day that had bookings, then a total row.
// Cancelled bookings never count. Adults, children and infants include the people on charters (as in the
// owner's own spreadsheet); a charter is also counted once in Charters and earns the flat charter
// price, while everyone else earns the adult or child price.
const { bookingValue } = require('./prices');
const { showDay } = require('./dates');

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const isMonth = (value) => typeof value === 'string' && MONTH.test(value);

// First and last day of a month as YYYY-MM-DD text. Because days are stored in that form, "this
// month" is just a range of text.
const monthRange = (month) => ({ first: `${month}-01`, last: `${month}-31` });

const empty = () => ({ adults: 0, children: 0, infants: 0, charters: 0, income: 0 });

// bookings: the active bookings in the month. current: today's prices (for bookings with none saved).
// Returns { days, total } with income in pence, or null if some booking's price can't be worked out.
const buildReport = (bookings, current) => {
    const days = new Map();
    const total = empty();
    for (const booking of bookings) {
        const value = bookingValue(booking, current);
        if (value === null) return null;
        const day = days.get(booking.date) || empty();
        const add = (to) => {
            to.adults += Number(booking.adults) || 0;
            to.children += Number(booking.children) || 0;
            to.infants += Number(booking.infants) || 0;
            to.charters += booking.charter === 'true' ? 1 : 0;
            to.income += value;
        };
        add(day);
        add(total);
        days.set(booking.date, day);
    }
    return {
        days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, numbers]) => ({ date, ...numbers })),
        total,
    };
};

const pounds = (pence) => (pence / 100).toFixed(2);

// Dates read day-month-year, and money has two decimals, so it opens neatly in a spreadsheet
const toCsv = ({ days, total }) => {
    const row = (label, n) => [label, n.adults, n.children, n.infants, n.adults + n.children + n.infants, n.charters, pounds(n.income)].join(',');
    return [
        'Date,Adults,Children,Infants,Passengers,Charters,Income (GBP)',
        ...days.map((day) => row(showDay(day.date), day)),
        row('Total', total),
    ].join('\r\n') + '\r\n';
};

module.exports = { isMonth, monthRange, buildReport, toCsv };
