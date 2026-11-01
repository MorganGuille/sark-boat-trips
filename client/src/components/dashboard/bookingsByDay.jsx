import { prettyDate } from '../../utils/dates.js'
import { formatPounds } from '../../utils/money.js'
import { PAYMENT, partyOf, guestsOf, amountOf, nameOf } from './bookingDetails.js'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// The upcoming bookings and search results (spec P2-3): grouped by day, each day with its totals and
// Open day, which shows that day with Edit, Mark paid and Cancel. bookings arrive in date and trip order.
function BookingsByDay({ bookings, onOpenDay }) {
    const days = []
    for (const booking of bookings) {
        const last = days[days.length - 1]
        if (last && last.date === booking.date) last.bookings.push(booking)
        else days.push({ date: booking.date, bookings: [booking] })
    }

    return (
        <div className='byDay'>
            {days.map(({ date, bookings: dayBookings }) => {
                const active = dayBookings.filter((b) => b.status !== 'cancelled')
                const cancelled = dayBookings.length - active.length
                const totals = [
                    active.length ? `${plural(active.length, 'booking', 'bookings')} · ${plural(active.reduce((sum, b) => sum + guestsOf(b), 0), 'guest', 'guests')}` : 'No active bookings',
                    cancelled ? `${cancelled} cancelled` : null,
                ].filter(Boolean).join(' · ')
                return (
                    <section className='byDayGroup' key={date} aria-label={prettyDate(date)}>
                        <div className='byDayHead'>
                            <h3>{prettyDate(date)}</h3>
                            <span className='muted'>{totals}</span>
                            <button type='button' className='btnLink' onClick={() => onOpenDay(date)}>
                                Open day<span className='sr-only'> {prettyDate(date)}</span> →
                            </button>
                        </div>
                        <ul className='byDayRows'>
                            {dayBookings.map((booking) => {
                                const payment = PAYMENT[booking.paymentStatus] || PAYMENT.unpaid
                                const amount = amountOf(booking)
                                return (
                                    <li key={booking._id} className={booking.status === 'cancelled' ? 'byDayRow cancelledRow' : 'byDayRow'}>
                                        <span className='byDayTime'>{booking.tripLabel || booking.timeslot}</span>
                                        <span className='byDayName'>
                                            {nameOf(booking)}
                                            {booking.charter === 'true' ? <span className='badge'>Charter</span> : null}
                                            {booking.status === 'cancelled' ? <span className='badge badgeCancelled'>Cancelled</span> : null}
                                            {booking.reference ? <span className='bookingRef'>{booking.reference}</span> : null}
                                        </span>
                                        <span>{partyOf(booking)}</span>
                                        <span>
                                            <span className={`payBadge ${payment.className}`}>{payment.label}</span>
                                            {Number.isFinite(amount) ? <span className='payAmount'>{formatPounds(amount / 100)}</span> : null}
                                        </span>
                                        <span className='byDayContact'>
                                            {booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : null}
                                            {booking.phone ? <a href={`tel:${booking.phone}`}>{booking.phone}</a> : null}
                                            {!booking.email && !booking.phone ? '—' : null}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )
            })}
        </div>
    )
}

export default BookingsByDay
