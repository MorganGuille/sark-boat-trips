// Every date in the database and over the API is a day written as 'YYYY-MM-DD' (for example
// '2027-05-01'). In that form dates sort and compare correctly as plain text, so "this month" and
// "from today" are simple searches, and there is no time zone to get wrong. People in Britain read
// day-month-year, so a date is turned into 'dd-mm-yyyy' only where a person will read it (emails and
// messages here, the screens in the client's utils/dates.js).

// 'YYYY-MM-DD' becomes the number yyyymmdd (easy to compare), or null if it isn't a real date
const dayNumber = (value) => {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const real = new Date(Date.UTC(year, month - 1, day));
    if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
    return year * 10000 + month * 100 + day;
};

const isDay = (value) => dayNumber(value) !== null;

// '2027-05-01' becomes '01-05-2027' for a person to read. Anything else is returned as it is.
const showDay = (value) => (isDay(value) ? value.split('-').reverse().join('-') : value);

module.exports = { dayNumber, isDay, showDay };
