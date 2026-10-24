const pad = (n) => String(n).padStart(2, '0')

// Bookings store dates as dd-mm-yyyy
export const formatDate = (date) =>
    `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`

export const parseDate = (value) => {
    const [day, month, year] = String(value).split('-').map(Number)
    return new Date(year, month - 1, day)
}

export const prettyDate = (value) => {
    const date = parseDate(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
