// Every date in the database and over the API is a day written as 'YYYY-MM-DD' (for example
// '2027-05-01'). In that form dates sort and compare correctly as plain text, so "this month" and
// "from today" are simple searches, and there is no time zone to get wrong. People in Britain read
// day-month-year, so a date is turned into 'dd-mm-yyyy' only where a person will read it (messages
// and the report here, the screens in the client's utils/dates.js); emails write the month out.

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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month: MONTHS[month - 1], day, weekday: DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] };
};

// For emails, where the month written out can't be misread (09-11 is 11 September to an American):
// '2026-11-09' becomes 'Monday 9 November 2026' (longDay) or 'Mon 9 Nov' for subject lines (shortDay).
const longDay = (value) => {
    if (!isDay(value)) return value;
    const { year, month, day, weekday } = parts(value);
    return `${weekday} ${day} ${month} ${year}`;
};
const shortDay = (value) => {
    if (!isDay(value)) return value;
    const { month, day, weekday } = parts(value);
    return `${weekday.slice(0, 3)} ${day} ${month.slice(0, 3)}`;
};

module.exports = { dayNumber, isDay, showDay, longDay, shortDay };
