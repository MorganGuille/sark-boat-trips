const pad = (n) => String(n).padStart(2, '0')

// Bookings store dates as dd-mm-yyyy
export const formatDate = (date) =>
    `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`

export const parseDate = (value) => {
    const [day, month, year] = String(value).split('-').map(Number)
    return new Date(year, month - 1, day)
}

// Season dates arrive as 'YYYY-MM-DD'. Build the day from its numbers, never from the text:
// new Date('2026-05-01') means midnight in London, which is still 30 April for a visitor in
// California, and some date text (like '2026-05-01 00:00') isn't understood by Safari at all.
export const parseIsoDay = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

export const prettyDate = (value) => {
    const date = parseDate(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
