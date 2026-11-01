import { useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_LINK } from '../utils/contact.js'

// Where a customer lands after closing Stripe's card page, for a trip or a charter. Stripe sends them
// back to /canceled?kind=trip or ?kind=charter, so Try again returns them to the page they came from.
function Canceled() {
    // The prerendered page has no address to read, so it starts as a trip and React then updates it
    const charter = useSyncExternalStore(
        () => () => {},
        () => new URLSearchParams(window.location.search).get('kind') === 'charter',
        () => false
    )

    return (
        <>
            <title>Sark Boat Trips | Booking Not Made</title>

            <main id="main-content" className='stripe-landing'>

                <div role="status" aria-live="polite">
                    <h2>Booking not made</h2>
                    <p>
                        It looks like the card page was closed before your card was saved, so nothing has been booked.
                        Don&apos;t worry: nothing has been charged.
                    </p>
                </div>

                <section aria-label="Support options" style={{ marginTop: '20px' }}>
                    <p>Please try again, or get in touch if you need some help!</p>

                    <address style={{ fontStyle: 'normal', margin: '20px 0' }}>
                        <p>
                            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                        </p>
                        <p>
                            WhatsApp: <a href={WHATSAPP_LINK}>{CONTACT_PHONE}</a>
                        </p>
                    </address>
                </section>

                <div className='landingButtons'>
                    <Link className='btn' to={charter ? '/charters' : '/bookings'}
                        aria-label={charter ? 'Return to the charters page to try again' : 'Return to the booking page to try again'}>
                        Try again
                    </Link>
                    <Link className='btn' to='/'>Back to home</Link>
                </div>
            </main>
        </>
    )
}

export default Canceled