import { Link } from 'react-router'

function Canceled() {
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
                            Email: <a href="mailto:sarkboattrips@gmail.com">sarkboattrips@gmail.com</a>
                        </p>
                        <p>
                            WhatsApp: <a href="https://wa.me/447911764246">+44 7911 764 246</a>
                        </p>
                    </address>
                </section>

                <Link className='btn' to='/charters' aria-label="Return to the charters page to try again">
                    Back to charters
                </Link>
            </main>
        </>
    )
}

export default Canceled