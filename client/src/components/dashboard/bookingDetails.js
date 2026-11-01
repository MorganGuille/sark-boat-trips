// How a booking's details read on the dashboard, shared by the day's table and the upcoming and search lists

// How each payment status reads (see paymentsspec.md)
export const PAYMENT = {
    unpaid: { label: 'Unpaid', className: 'payUnpaid' },
    card_saved: { label: 'Card saved', className: 'payCard' },
    charging: { label: 'Charging…', className: 'payCard' },
    paid: { label: 'Paid online', className: 'payPaid' },
    paid_in_person: { label: 'Paid in person', className: 'payPaid' },
}

// "2 adults, 1 child", or "—" when the party is missing (allowed on the dashboard)
export const partyOf = (booking) => {
    const counts = [['adult', 'adults', booking.adults], ['child', 'children', booking.children], ['infant', 'infants', booking.infants]]
        .map(([one, many, n]) => [one, many, Number(n) || 0])
        .filter(([, , n]) => n)
    if (!counts.length) return '—'
    return counts.map(([one, many, n]) => `${n} ${n === 1 ? one : many}`).join(', ')
}

// Everyone on the booking, infants included (they take a seat)
export const guestsOf = (booking) => (Number(booking.adults) || 0) + (Number(booking.children) || 0) + (Number(booking.infants) || 0)

// In pence: what was paid, or what is due
export const amountOf = (booking) => {
    const status = booking.paymentStatus || 'unpaid'
    return status === 'paid' || status === 'paid_in_person' ? booking.amountPaid : booking.amountDue
}

export const nameOf = (booking) => [booking.firstName, booking.lastName].filter(Boolean).join(' ') || '(no name)'
