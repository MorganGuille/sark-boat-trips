// The monthly passenger and income report. One row per day that had bookings, then a total row, then
// the gift vouchers sold and used that month (owner, 2 Nov 2026). A voucher's money counts when it is
// sold, so a booking it pays for only counts what was still to pay (bookingValue takes it off).
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

// Gift vouchers sold that month (with the money taken: prizes count as sold for nothing) and used that
// month. Months are counted in UTC, which is at most an hour out from Guernsey.
const voucherSummary = async (month) => {
    const Vouchers = require('../models/vouchers');
    const [year, number] = month.split('-').map(Number);
    const between = { $gte: new Date(Date.UTC(year, number - 1, 1)), $lt: new Date(Date.UTC(year, number, 1)) };
    const sold = await Vouchers.find({ createdAt: between });
    const used = await Vouchers.countDocuments({ status: 'used', usedAt: between });
    return { sold: sold.length, income: sold.reduce((sum, v) => sum + (v.amountPaid || 0), 0), used };
};

// Dates read day-month-year, and money has two decimals, so it opens neatly in a spreadsheet. The gift
// voucher rows only appear in a month that had any.
const toCsv = ({ days, total }, vouchers) => {
    const row = (label, n) => [label, n.adults, n.children, n.infants, n.adults + n.children + n.infants, n.charters, pounds(n.income)].join(',');
    return [
        'Date,Adults,Children,Infants,Passengers,Charters,Income (GBP)',
        ...days.map((day) => row(showDay(day.date), day)),
        row('Total', total),
        ...(vouchers?.sold || vouchers?.used ? [
            '',
            'Gift vouchers,Sold,Used,,,,Income (GBP)',
            ['Gift vouchers', vouchers.sold, vouchers.used, '', '', '', pounds(vouchers.income)].join(','),
            ['Total with vouchers', '', '', '', '', '', pounds(total.income + vouchers.income)].join(','),
        ] : []),
    ].join('\r\n') + '\r\n';
};

module.exports = { isMonth, monthRange, buildReport, toCsv, voucherSummary };
