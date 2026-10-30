import { useEffect, useState } from 'react'
import axios from 'axios'
import { URL } from '../../config.js'
import { showDay } from '../utils/dates.js'
import { formatPounds } from '../utils/money.js'
import { FREE_CANCEL_HOURS } from '../utils/policy.js'
import { CONTACT_EMAIL } from '../utils/contact.js'

function Success() {
    const [response, setResponseData] = useState(null)
    const [problem, setProblem] = useState(null) // the server's reason it isn't booked, e.g. the trip filled up
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
            } else {
                setProblem(res.data.message);
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
            <title>Sark Boat Trips | Booking Confirmed</title>

            <main id="main-content" className='stripe-landing'>
                <div role="status" aria-live="polite">
                    {loading ? (
                        <h1>Verifying your booking...</h1>
                    ) : response ? (
                        <>
                            <h1>Success!</h1>
                            <p>
                                <strong>{response.name}</strong>, thank you so much for booking {response.charter ? 'your charter' : 'with us'}!
                            </p>
                            <p>
                                Your {response.charter ? 'charter' : 'trip'} is booked for <strong>{response.time || response.timeslot} on {showDay(response.date)}</strong>,
                                and we&apos;ve emailed you the details.
                            </p>
                            <p>
                                Your card{response.cardLabel ? ` (${response.cardLabel})` : ''} has been saved and <strong>nothing has been taken yet</strong>.
                                {Number.isFinite(response.amount) ? ` ${formatPounds(response.amount / 100)}` : ' The price'} will be charged when
                                your {response.charter ? 'charter' : 'trip'} starts. If we cancel because of the weather, you won&apos;t be charged.
                            </p>
                            <p>
                                Need to cancel? Let us know at least {response.charter ? FREE_CANCEL_HOURS.charter : FREE_CANCEL_HOURS.trip} hours
                                before and you won&apos;t be charged. <a href='/terms'>Terms and conditions</a>
                            </p>

                            <section aria-label="Next steps" style={{ marginTop: '20px' }}>
                                {response.charter ? (
                                    <p>
                                        If you haven&apos;t already, please contact us to arrange your trip and let us know what we can do for you!
                                    </p>
                                ) : (
                                    <p>Please be at the {response.harbour || 'Creux Harbour'} shortly before your trip. If anything changes, just get in touch.</p>
                                )}

                                <address style={{ fontStyle: 'normal' }}>
                                    <p>
                                        Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                                    </p>
                                    <p>
                                        WhatsApp: <a href="https://wa.me/447911764246">+44 7911 764 246</a>
                                    </p>
                                </address>
                            </section>
                        </>
                    ) : (
                        <>
                            <h1>We couldn&apos;t confirm your booking</h1>
                            {problem ? <p>{problem}</p> : null}
                            <p>
                                Nothing has been charged. Please contact us and we&apos;ll sort it out, or choose another trip.
                            </p>
                            <address style={{ fontStyle: 'normal' }}>
                                <p>
                                    Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                                </p>
                                <p>
                                    WhatsApp: <a href="https://wa.me/447911764246">+44 7911 764 246</a>
                                </p>
                            </address>
                        </>
                    )}
                </div>
            </main>
        </>
    )
}

export default Success