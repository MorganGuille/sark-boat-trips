import { showDay } from '../../utils/dates.js'
import { formatPounds } from '../../utils/money.js'

// How each payment status reads on the dashboard (see paymentsspec.md)
const PAYMENT = {
    unpaid: { label: 'Unpaid', className: 'payUnpaid' },
    card_saved: { label: 'Card saved', className: 'payCard' },
    charging: { label: 'Charging…', className: 'payCard' },
    paid: { label: 'Paid online', className: 'payPaid' },
    paid_in_person: { label: 'Paid in person', className: 'payPaid' },
}

function BookingsTable({ bookings, showDate, onEdit, onCancel, onRestore, onDeletePermanently, onMarkPaid, onMarkUnpaid }) {

    const guests = (booking) => {
        const children = Number(booking.children) || 0
        const adults = Number(booking.adults) || 0
        if (!adults && !children) return '—'
        return `${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}`
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
                        const amount = status === 'paid' || status === 'paid_in_person' ? booking.amountPaid : booking.amountDue
                        return (
                        <tr key={booking._id} className={isCancelled ? 'cancelledRow' : undefined}>
                            {showDate ? <td>{showDay(booking.date)}</td> : null}
                            <td>{booking.timeslot}</td>
                            <td>
                                {[booking.firstName, booking.lastName].filter(Boolean).join(' ') || '(no name)'}
                                {booking.charter === 'true' ? <span className='badge'>Charter</span> : null}
                                {isCancelled ? <span className='badge badgeCancelled'>Cancelled</span> : null}
                            </td>
                            <td>{guests(booking)}</td>
                            <td>
                                <span className={`payBadge ${payment.className}`}>{payment.label}</span>
                                {Number.isFinite(amount) ? <span className='payAmount'>{formatPounds(amount / 100)}</span> : null}
                                {booking.paymentNote ? <span className='payNote'>{booking.paymentNote}</span> : null}
                            </td>
                            <td>
                                {booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : null}
                                {booking.email && booking.phone ? <br /> : null}
                                {booking.phone ? <a href={`tel:${booking.phone}`}>{booking.phone}</a> : null}
                                {!booking.email && !booking.phone ? '—' : null}
                            </td>
                            <td>{booking.accommodation}</td>
                            <td className='messageCell'>{booking.message}</td>
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
