import { showDay } from '../../utils/dates.js'

function BookingsTable({ bookings, showDate, onEdit, onCancel, onRestore, onDeletePermanently }) {

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
                        <th scope='col'>Contact</th>
                        <th scope='col'>Staying</th>
                        <th scope='col'>Message</th>
                        <th scope='col'><span className='sr-only'>Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {bookings.map((booking) => {
                        const isCancelled = booking.status === 'cancelled'
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
