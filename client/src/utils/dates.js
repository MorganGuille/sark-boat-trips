// Every date the server stores or sends is a day written 'YYYY-MM-DD' (for example '2027-05-01').
// People in Britain read day-month-year, so it is turned into 'dd-mm-yyyy' or a long form only
// where someone reads it (showDay, prettyDate). Never build a date from text with new Date('...'):
// Safari reads some text differently to Chrome, and a UTC date shows up a day early for visitors
// west of London. Build it from the numbers instead (parseDay).
const pad = (n) => String(n).padStart(2, '0')

// A Date (what the calendar gives) becomes the day it shows on the visitor's own calendar
export const toDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// '2027-05-01' becomes a Date at local midnight of that day, or null if it isn't a day
export const parseDay = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

// '2027-05-01' becomes '01-05-2027'. Anything else is shown as it is.
export const showDay = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value).split('-').reverse().join('-') : value)

export const prettyDate = (value) => {
    const date = parseDay(value)
    if (!date || Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
