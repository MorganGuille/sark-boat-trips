import { showDay } from '../../utils/dates.js'
import { formatPounds } from '../../utils/money.js'
import { PAYMENT, partyOf, amountOf, nameOf } from './bookingDetails.js'

// A long email address may go onto a second line at the @ (morgan_guille / @hotmail.com), so it doesn't
// push the buttons off the side of the table on a laptop
const withBreak = (email) => {
    const at = email.indexOf('@')
    return at > 0 ? <>{email.slice(0, at)}<wbr />{email.slice(at)}</> : email
}

function BookingsTable({ bookings, showDate, trips = [], onEdit, onCancel, onRestore, onDeletePermanently, onMarkPaid, onMarkUnpaid }) {

    // The day's trip may have moved: show its time that day (not in search results, which span days)
    const timeCell = (booking) => {
        const trip = !showDate && trips.find((t) => t.timeslot === booking.timeslot)
        if (trip?.extra) return <><strong>{trip.time}</strong><br /><span className='tripNameCell'>{trip.name}</span></>
        return trip?.timeChanged
            ? <><strong className='movedTime'>{trip.time}</strong><br /><s className='usualTime'><span className='sr-only'>moved from </span>{booking.timeslot}</s></>
            : booking.tripLabel || booking.timeslot // search results, or a trip no longer running that day
    }

    return (
        <div className='tableWrap'>
            <table className='bookingsTable'>
                <thead>
                    <tr>
                        {showDate ? <th scope='col'>Date</th> : null}
                        <th scope='col'>Time</th>
                        <th scope='col'>Name</th>
                        <th scope='col'>Party</th>
                        <th scope='col'>Payment</th>
                        <th scope='col'>Contact</th>
                        <th scope='col'>Staying</th>
                        <th scope='col'>Message</th>
                        <th scope='col'><span className='sr-only'>Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {bookings.map((booking) => {
                        const isCancelled = booking.status === 'cancelled'
                        const payment = PAYMENT[booking.paymentStatus] || PAYMENT.unpaid
                        const status = booking.paymentStatus || 'unpaid'
                        const amount = amountOf(booking)
                        return (
                        <tr key={booking._id} className={isCancelled ? 'cancelledRow' : undefined}>
                            {showDate ? <td data-label='Date'>{showDay(booking.date)}</td> : null}
                            <td data-label='Time'>{timeCell(booking)}</td>
                            <td data-label='Name' className='nameCell'>
                                {nameOf(booking)}
                                {booking.charter === 'true' ? <span className='badge'>Charter</span> : null}
                                {isCancelled ? <span className='badge badgeCancelled'>Cancelled</span> : null}
                                {booking.reference ? <span className='bookingRef'>{booking.reference}</span> : null}
                            </td>
                            <td data-label='Party'>{partyOf(booking)}</td>
                            <td data-label='Payment'>
                                <span className={`payBadge ${payment.className}`}>{payment.label}</span>
                                {Number.isFinite(amount) ? <span className='payAmount'>{formatPounds(amount / 100)}</span> : null}
                                {status === 'card_saved' && booking.cardLabel ? <span className='payCardLabel'>{booking.cardLabel.split(/ (?=\()/).map((part) => <span key={part}>{part} </span>)}</span> : null}
                                {booking.paymentNote ? <span className='payNote'>{booking.paymentNote}</span> : null}
                                {booking.voucher?.code ? <span className='payNote'>Voucher {booking.voucher.code}: {formatPounds(booking.voucher.value / 100)} off</span> : null}
                            </td>
                            <td data-label='Contact'>
                                {booking.email ? <a href={`mailto:${booking.email}`}>{withBreak(booking.email)}</a> : null}
                                {booking.email && booking.phone ? <br /> : null}
                                {booking.phone ? <a href={`tel:${booking.phone}`}>{booking.phone}</a> : null}
                                {!booking.email && !booking.phone ? '—' : null}
                            </td>
                            <td data-label='Staying'>{booking.accommodation}</td>
                            <td data-label='Message' className='messageCell'>{booking.message}</td>
                            <td className='actionsCell'>
                                {isCancelled ? (<>
                                    <button type='button' className='btn btnSmall' onClick={() => onRestore(booking)}>Restore</button>
                                    <button type='button' className='btn btnSmall btnDanger' onClick={() => onDeletePermanently(booking)}>Delete permanently</button>
                                </>) : (<>
                                    <button type='button' className='btn btnSmall' onClick={() => onEdit(booking)}>Edit</button>
                                    {status === 'unpaid' || status === 'card_saved' ? (
                                        <button type='button' className='btn btnSmall' onClick={() => onMarkPaid(booking)}>Mark paid</button>
                                    ) : null}
                                    {status === 'paid_in_person' ? (
                                        <button type='button' className='btn btnSmall btnGhost' onClick={() => onMarkUnpaid(booking)}>Undo paid</button>
                                    ) : null}
                                    <button type='button' className='btn btnSmall btnDanger' onClick={() => onCancel(booking)}>Cancel</button>
                                </>)}
                            </td>
                        </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default BookingsTable
