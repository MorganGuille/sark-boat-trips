import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import axios from 'axios'
import { URL } from '../../config.js'
import { formatPounds } from '../utils/money.js'
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_LINK } from '../utils/contact.js'
import '../css/manageBooking.css'

// "Manage my booking" (spec P2-6): the page behind the link in every customer email. Up to the
// free-cancellation deadline the customer can cancel, or add or remove people; a different day or
// time is a message to us. After the deadline it shows how to get in touch. The server decides
// what is allowed (server/controllers/manage.js); this page only shows it.
const MAX_MESSAGE = 1000

const pounds = (pence) => formatPounds(pence / 100)

// What the booking would cost with these numbers: a charter is a flat price, infants are free
const priceFor = (booking, party) => {
    const { adult, child, charter } = booking.prices
    if (booking.charter) return charter
    if (adult == null || child == null) return null
    return party.adults * adult + party.children * child
}

const paymentText = (booking) => {
    if (booking.cancelled) return booking.paymentStatus === 'card_saved' ? 'Nothing will be charged' : null
    if (['paid', 'paid_in_person'].includes(booking.paymentStatus)) return 'Paid, thank you'
    if (booking.paymentStatus === 'voucher') return 'Paid with a gift voucher'
    if (booking.paymentStatus === 'charging') return 'Being charged now'
    const amount = booking.amount == null ? 'The trip price' : pounds(booking.amount)
    if (booking.paymentStatus === 'card_saved') {
        return `${amount}, charged to your saved card${booking.cardLabel ? ` (${booking.cardLabel})` : ''} when your ${booking.charter ? 'charter' : 'trip'} starts`
    }
    return `${amount}, paid at the end of the trip by cash or card`
}

const Contact = () => (
    <address className='manageContact'>
        <p>Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>WhatsApp or phone: <a href={WHATSAPP_LINK}>{CONTACT_PHONE}</a></p>
    </address>
)

function ManageBooking() {
    const { token } = useParams()
    const [booking, setBooking] = useState(null)
    const [problem, setProblem] = useState(null) // the booking couldn't be loaded
    const [notice, setNotice] = useState(null) // { text, kind: 'success' | 'error' }
    const [party, setParty] = useState({ adults: '', children: '', infants: '' })
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)

    const show = (data) => {
        setBooking(data)
        setParty({ adults: String(data.adults), children: String(data.children), infants: String(data.infants) })
    }

    useEffect(() => {
        axios.get(`${URL}/bookings/manage/${token}`)
            .then((res) => show(res.data.booking))
            .catch((error) => setProblem(error.response?.data?.data || "We couldn't load your booking. Please try again, or contact us."))
    }, [token])

    // Sends a change; the server replies with what happened and the booking as it now is
    const send = async (path, body, onSuccess) => {
        setBusy(true)
        setNotice(null)
        try {
            const res = await axios.post(`${URL}/bookings/manage/${token}/${path}`, body)
            setNotice({ text: res.data.data, kind: 'success' })
            if (res.data.booking) show(res.data.booking)
            onSuccess?.()
        } catch (error) {
            setNotice({ text: error.response?.data?.data || 'Something went wrong. Please try again, or contact us.', kind: 'error' })
        } finally {
            setBusy(false)
        }
    }

    if (problem) {
        return (
            <main id="main-content" className='manageBooking'>
                <title>Sark Boat Trips | Your Booking</title>
                <meta name="robots" content="noindex" />
                <h1>Your booking</h1>
                <p role='alert'>{problem}</p>
                <Contact />
            </main>
        )
    }
    if (!booking) {
        return (
            <main id="main-content" className='manageBooking'>
                <title>Sark Boat Trips | Your Booking</title>
                <meta name="robots" content="noindex" />
                <h1>Your booking</h1>
                <p role='status'>Loading your booking…</p>
            </main>
        )
    }

    const numbers = { adults: Number(party.adults), children: Number(party.children) || 0, infants: Number(party.infants) || 0 }
    const seats = numbers.adults + numbers.children + numbers.infants
    const changed = numbers.adults !== booking.adults || numbers.children !== booking.children || numbers.infants !== booking.infants
    const newPrice = priceFor(booking, numbers)
    const what = booking.charter ? 'charter' : booking.tripName || 'trip'

    const saveParty = () => {
        const price = newPrice == null || booking.charter ? '' : `\n\nThe new price is ${pounds(newPrice)}.`
        if (!window.confirm(`Change your booking to ${seats} ${seats === 1 ? 'person' : 'people'}?${price}`)) return
        send('party', party)
    }
    const cancel = () => {
        if (!window.confirm(`Cancel your ${what} on ${booking.day}?\n\nThis can't be undone online. Your card won't be charged.`)) return
        send('cancel', {})
    }

    return (
        <main id="main-content" className='manageBooking'>
            <title>Sark Boat Trips | Your Booking</title>
            <meta name="robots" content="noindex" />
            <h1>{booking.firstName ? `Hello ${booking.firstName}` : 'Your booking'}</h1>

            {notice ? <p className={`manageNotice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null}

            <section className='manageCard' aria-labelledby='bookingTitle'>
                <h2 id='bookingTitle'>{booking.cancelled ? 'Your cancelled booking' : `Your ${booking.charter ? 'private charter' : 'booking'}`}</h2>
                <dl className='manageDetails'>
                    {booking.tripName ? <><dt>Trip</dt><dd>{booking.tripName}</dd></> : null}
                    <dt>Date</dt><dd>{booking.day}</dd>
                    <dt>Time</dt><dd>{booking.time}</dd>
                    <dt>Meeting point</dt><dd><a href={booking.harbour.map} target='_blank' rel='noreferrer'>{booking.harbour.name}, Sark</a></dd>
                    <dt>Party</dt><dd>{booking.party}</dd>
                    {paymentText(booking) ? <><dt>Payment</dt><dd>{paymentText(booking)}</dd></> : null}
                    {booking.reference ? <><dt>Booking reference</dt><dd>{booking.reference}</dd></> : null}
                </dl>
                {booking.tripNote && !booking.cancelled ? <p className='manageNote'>{booking.tripNote}</p> : null}
            </section>

            {booking.canChange ? (<>
                <p className='manageDeadline'>
                    You can change or cancel this booking free of charge until <strong>{booking.freeUntil}</strong>.
                </p>

                <section className='manageCard' aria-labelledby='partyTitle'>
                    <h2 id='partyTitle'>Change the number of people</h2>
                    <div className='manageParty'>
                        <label>
                            Adults <span>15 and over</span>
                            <input type='number' min='1' max='12' value={party.adults} onChange={(e) => setParty({ ...party, adults: e.target.value })} />
                        </label>
                        <label>
                            Children <span>4 to 14</span>
                            <input type='number' min='0' max='12' value={party.children} onChange={(e) => setParty({ ...party, children: e.target.value })} />
                        </label>
                        <label>
                            Infants <span>3 and under, free</span>
                            <input type='number' min='0' max='12' value={party.infants} onChange={(e) => setParty({ ...party, infants: e.target.value })} />
                        </label>
                    </div>
                    <p className='muted'>
                        Up to {booking.maxSeats} {booking.maxSeats === 1 ? 'person' : 'people'} can come on this {booking.charter ? 'charter' : 'trip'} (everyone takes a seat, infants too).
                        {changed && newPrice != null && !booking.charter ? <> New price: <strong>{pounds(newPrice)}</strong>{booking.amount != null ? ` (was ${pounds(booking.amount)})` : ''}.</> : null}
                    </p>
                    <button className='btn' type='button' onClick={saveParty} disabled={busy || !changed || !(numbers.adults >= 1)}>
                        {busy ? 'Saving…' : 'Save the new numbers'}
                    </button>
                </section>

                <section className='manageCard' aria-labelledby='cancelTitle'>
                    <h2 id='cancelTitle'>Cancel your booking</h2>
                    <p>Can&apos;t come any more? Cancel now and you won&apos;t be charged.</p>
                    <button className='btn btnDanger' type='button' onClick={cancel} disabled={busy}>Cancel my booking</button>
                </section>
            </>) : (
                <section className='manageCard' aria-labelledby='changeTitle'>
                    <h2 id='changeTitle'>Need to change something?</h2>
                    <p>{booking.why}</p>
                    {booking.cancelled ? null : (
                        <p>
                            Bookings cancelled later than {booking.charter ? '48' : '24'} hours before, or not used, are charged in full (see our <a href='/terms'>terms</a>).
                            If something has come up, please get in touch and we&apos;ll do our best to help.
                        </p>
                    )}
                    <Contact />
                </section>
            )}

            <section className='manageCard' aria-labelledby='messageTitle'>
                <h2 id='messageTitle'>Send us a message</h2>
                <p>Would you like a different day or time, or have a question? Write to us here and we&apos;ll get back to you.</p>
                <label className='manageMessage'>
                    Your message
                    <textarea rows='4' maxLength={MAX_MESSAGE} value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>
                <button className='btn' type='button' onClick={() => send('message', { message }, () => setMessage(''))} disabled={busy || !message.trim()}>
                    {busy ? 'Sending…' : 'Send message'}
                </button>
            </section>

            {booking.canChange ? <Contact /> : null}
        </main>
    )
}

export default ManageBooking
