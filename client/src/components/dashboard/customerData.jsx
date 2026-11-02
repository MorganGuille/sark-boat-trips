import { useState } from 'react'
import { getCustomer, downloadCustomer, eraseCustomer } from '../../services.jsx/customers.jsx'
import { showDay } from '../../utils/dates.js'
import { PAYMENT, partyOf } from './bookingDetails.js'

// Customer data (spec P2-13, owner's choices 3 Nov 2026), shown when the Bookings search is an email
// address: everything held for it, a download to send the customer, and Erase (details blanked,
// dates, parties and money kept for the reports, their saved card removed at Stripe).
function CustomerData({ email, onResult, onErased }) {
    const [data, setData] = useState(null)
    const [open, setOpen] = useState(false)
    const [problem, setProblem] = useState(null)
    const [confirming, setConfirming] = useState(false)
    const [confirm, setConfirm] = useState('')
    const [busy, setBusy] = useState(false)

    const failed = (error, fallback) => {
        if (error.response?.status === 401) return
        onResult(error.response?.data?.data || fallback, 'error')
    }

    const load = async () => {
        setProblem(null)
        try {
            setData(await getCustomer(email))
        } catch (error) {
            if (error.response?.status !== 401) setProblem(error.response?.data?.data || 'Could not load their details. Try again in a moment.')
        }
    }
    const toggle = () => {
        if (!open && !data) load()
        setOpen((o) => !o)
        setConfirming(false)
    }
    const download = async () => {
        try { await downloadCustomer(email) } catch (error) { failed(error, 'Could not download their details. Try again in a moment.') }
    }
    const erase = async () => {
        setBusy(true)
        try {
            const res = await eraseCustomer(email, confirm)
            onResult(res.data)
            setConfirming(false)
            setConfirm('')
            await load()
            onErased()
        } catch (error) {
            failed(error, 'Could not erase their details. Try again in a moment.')
        } finally {
            setBusy(false)
        }
    }

    const nothing = data && !data.bookings.length && !data.vouchers.length
    const ready = !busy && confirm.trim().toLowerCase() === email

    return (
        <section className='customerData' aria-label='Customer data'>
            <button type='button' className='btn btnSmall btnGhost' onClick={toggle} aria-expanded={open}>
                {open ? 'Hide customer data' : `Customer data for ${email}`}
            </button>
            {open ? (
                <div className='customerDataBody'>
                    <p className='muted'>Everything held for this email address, to send them if they ask, or to erase if they ask to be removed. Also check your Notes and your inbox.</p>
                    {problem ? <p className='seasonError' role='alert'>{problem}</p> : null}
                    {!problem && !data ? <p className='muted' aria-busy='true'>Loading…</p> : null}
                    {nothing ? <p className='emptyState'>Nothing is held for {email}.</p> : null}
                    {data && !nothing ? (<>
                        {data.bookings.length ? (<>
                            <h3>Bookings ({data.bookings.length})</h3>
                            <ul className='customerList'>
                                {data.bookings.map((b) => (
                                    <li key={b._id}>
                                        <strong>{showDay(b.date)}, {b.trip}</strong>
                                        <span>{[b.firstName, b.lastName].filter(Boolean).join(' ')} · {partyOf(b)} · {b.reference}</span>
                                        <span className='muted'>{b.status === 'cancelled' ? 'Cancelled' : PAYMENT[b.paymentStatus]?.label || b.paymentStatus}{b.phone ? ` · ${b.phone}` : ''}</span>
                                    </li>
                                ))}
                            </ul>
                        </>) : null}
                        {data.vouchers.length ? (<>
                            <h3>Gift vouchers ({data.vouchers.length})</h3>
                            <ul className='customerList'>
                                {data.vouchers.map((v) => (
                                    <li key={v.code}>
                                        <strong>{v.code}</strong>
                                        <span>{v.buyerEmail && v.buyerEmail.toLowerCase() === email ? `Bought for ${v.recipientName || 'someone'}` : `Given by ${v.buyerName || 'someone'}`}</span>
                                    </li>
                                ))}
                            </ul>
                        </>) : null}
                        <div className='customerActions'>
                            <button type='button' className='btn btnSmall' onClick={download}>Download their data</button>
                            {!confirming ? (
                                <button type='button' className='btn btnSmall btnDanger' onClick={() => setConfirming(true)} disabled={Boolean(data.eraseProblem)}>Erase</button>
                            ) : null}
                        </div>
                        {data.eraseProblem ? <p className='muted' role='note'>Can&apos;t erase yet: {data.eraseProblem}</p> : null}
                        {confirming ? (
                            // not a <form>: the site-wide form styles (bookingForm.css) would stretch its buttons
                            <div className='customerErase' role='group' aria-label='Erase their details'>
                                <p>This blanks their name, email, phone and messages on every booking and gift voucher, and removes their saved card at Stripe. Dates, party sizes and amounts stay, so your reports don&apos;t change. It can&apos;t be undone.</p>
                                <label htmlFor='eraseConfirm'>Type their email address to confirm</label>
                                <input id='eraseConfirm' type='email' value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete='off'
                                    onKeyDown={(e) => { if (e.key === 'Enter' && ready) erase() }} />
                                <div className='customerActions'>
                                    <button type='button' className='btn btnSmall btnDanger' onClick={erase} disabled={!ready}>{busy ? 'Erasing…' : 'Erase for good'}</button>
                                    <button type='button' className='btn btnSmall btnGhost' onClick={() => { setConfirming(false); setConfirm('') }} disabled={busy}>Cancel</button>
                                </div>
                            </div>
                        ) : null}
                    </>) : null}
                </div>
            ) : null}
        </section>
    )
}

export default CustomerData
