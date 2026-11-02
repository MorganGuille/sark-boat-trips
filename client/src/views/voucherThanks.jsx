import { useEffect, useState } from 'react'
import { verifyVoucher } from '../services.jsx/vouchers.jsx'
import { showDay } from '../utils/dates.js'
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_LINK } from '../utils/contact.js'

import '../css/giftVouchers.css'

// Where Stripe sends a voucher buyer after paying. Asking the server makes the voucher (if Stripe's
// webhook hasn't already) and says where it was sent.
function VoucherThanks() {
    const [voucher, setVoucher] = useState(null)
    const [problem, setProblem] = useState(null)
    // Only built in the browser (server/routes/pages.js), so the address is there from the start
    const [sessionId] = useState(() => new URLSearchParams(window.location.search).get('session_id'))
    const [loading, setLoading] = useState(Boolean(sessionId))

    useEffect(() => {
        if (!sessionId) return
        verifyVoucher(sessionId)
            .then((res) => (res.ok ? setVoucher(res) : setProblem(res.message)))
            .catch((error) => setProblem(error.response?.data?.message || null))
            .finally(() => setLoading(false))
    }, [sessionId])

    const sentTo = voucher && (voucher.sendOn
        ? <>We&apos;ll email it to <strong>{voucher.deliverTo}</strong> on <strong>{showDay(voucher.sendOn)}</strong>, in the morning. You&apos;ll find a receipt and a copy in your inbox now.</>
        : voucher.deliverTo === voucher.buyerEmail
            ? <>We&apos;ve emailed it to you at <strong>{voucher.deliverTo}</strong>, as a PDF to print or forward.</>
            : <>We&apos;ve emailed it to <strong>{voucher.deliverTo}</strong>, and sent you a receipt and a copy.</>)

    return (<>
        <title>Sark Boat Trips | Thank You</title>
        <main id="main-content" className='voucherThanks'>
            <div role="status" aria-live="polite">
                {loading ? <h1>Checking your payment…</h1> : voucher ? (<>
                    <h1>Thank you!</h1>
                    <p>Your gift voucher{voucher.recipientName ? <> for <strong>{voucher.recipientName}</strong></> : null} is ready.</p>
                    <dl>
                        <dt>Covers</dt><dd>{voucher.covers}</dd>
                        <dt>Valid until</dt><dd>{showDay(voucher.expiresOn)}</dd>
                        <dt>Code</dt><dd className='voucherCode'>{voucher.code}</dd>
                    </dl>
                    <p>{sentTo}</p>
                    <p>To use it, they just contact us with the code and we&apos;ll find them a day.</p>
                </>) : (<>
                    <h1>We couldn&apos;t confirm your voucher</h1>
                    {problem ? <p>{problem}</p> : null}
                    <p>If you were charged, please contact us and we&apos;ll sort it out straight away.</p>
                </>)}
                {!loading ? (
                    <address style={{ fontStyle: 'normal' }}>
                        <p>Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                        <p>WhatsApp: <a href={WHATSAPP_LINK}>{CONTACT_PHONE}</a></p>
                    </address>
                ) : null}
            </div>
        </main>
    </>)
}

export default VoucherThanks
