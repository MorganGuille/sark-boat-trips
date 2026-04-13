import React from 'react'
import { Link } from 'react-router'

function Canceled() {
    return (
        <>
            <title>Sark Boat Trips | Payment Canceled</title>

            <main id="main-content" className='stripe-landing'>

                <div role="status" aria-live="polite">
                    <h2>Payment Not Processed</h2>
                    <p>
                        Uh oh, it looks like something went wrong with your payment or the session was canceled.
                        Don't worry—your card has not been charged.
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