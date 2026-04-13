import { React, useEffect, useState } from 'react'
import axios from 'axios'
import { URL } from '../../config.js'

function Success() {
    const [response, setResponseData] = useState(null)
    const [loading, setLoading] = useState(true)

    const verifyPayment = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (!sessionId) {
            setLoading(false);
            return;
        }

        try {
            const res = await axios.get(`${URL}/charters/verify-payment?session_id=${sessionId}`);
            if (res.data.ok) {
                setResponseData(res.data);
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        verifyPayment();
    }, []);

    return (
        <>
            <title>Sark Boat Trips | Payment Successful</title>

            <main id="main-content" className='stripe-landing'>
                <div role="status" aria-live="polite">
                    {loading ? (
                        <h1>Verifying your booking...</h1>
                    ) : response ? (
                        <>
                            <h1>Success!</h1>
                            <p>
                                <strong>{response.name}</strong>, thank you so much for booking your charter tour with us!
                            </p>
                            <p>
                                Your deposit has been confirmed and your charter is reserved for <strong>{response.date}</strong>.
                            </p>

                            <section aria-label="Next steps" style={{ marginTop: '20px' }}>
                                <p>
                                    If you haven't already, please contact us to arrange your trip and let us know what we can do for you!
                                </p>

                                <address style={{ fontStyle: 'normal' }}>
                                    <p>
                                        Email: <a href="mailto:sarkboattrips@gmail.com">sarkboattrips@gmail.com</a>
                                    </p>
                                    <p>
                                        WhatsApp: <a href="https://wa.me/447911764246">+44 7911 764 246</a>
                                    </p>
                                </address>
                            </section>
                        </>
                    ) : (
                        <>
                            <h1>Something went wrong</h1>
                            <p>We couldn't verify your session. Please contact us if you believe this is an error.</p>
                        </>
                    )}
                </div>
            </main>
        </>
    )
}

export default Success