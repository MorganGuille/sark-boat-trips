import { useEffect, useState } from 'react'
import { listVouchers, addVoucher, markVoucherUsed, undoVoucher, resendVoucher, extendVoucher, downloadVoucher } from '../../services.jsx/vouchers.jsx'
import { showDay } from '../../utils/dates.js'
import { formatPounds } from '../../utils/money.js'

// The Vouchers tab (owner, 2 Nov 2026): every gift voucher, newest first, searchable by code, name,
// email or booking reference. Make a voucher is for ones paid by bank transfer or cash, or given as
// prizes. Use asks for the booking's reference (SBT-...), so the voucher comes off what that booking
// owes; Undo puts it back. Resend, Extend and PDF for lost emails, favours and printing. Used vouchers
// are hidden until Show used is ticked (owner, 2 Nov 2026), like cancelled bookings.

const PAID_BY = { online: 'Online', bank: 'Bank transfer', cash: 'Cash', free: 'No charge' }
const EMPTY = { kind: 'trip', adults: '2', children: '0', recipientName: '', message: '', buyerName: '', buyerEmail: '', recipientEmail: '', paidBy: 'bank', amountPaid: '', expiresOn: '', sendTo: 'none', sendOn: '' }

const statusOf = (voucher) => {
    if (voucher.status === 'used') return { label: 'Used', className: 'voucherUsed' }
    if (voucher.expired) return { label: 'Expired', className: 'voucherExpired' }
    return { label: 'Not used', className: 'voucherOpen' }
}
const madeOn = (voucher) => showDay(String(voucher.createdAt || '').slice(0, 10))

// The voucher being changed in its row: which action, and what's been typed
function RowAction({ voucher, action, onCancel, onDone, onResult }) {
    const [value, setValue] = useState(action === 'resend' ? voucher.deliverTo || voucher.recipientEmail || voucher.buyerEmail || '' : action === 'extend' ? voucher.expiresOn : '')
    const [busy, setBusy] = useState(false)
    const label = { use: 'Booking reference (optional)', resend: 'Email it to', extend: 'Valid until' }[action]
    const button = { use: 'Mark used', resend: 'Send', extend: 'Save' }[action]

    const go = async () => {
        setBusy(true)
        try {
            const call = { use: () => markVoucherUsed(voucher._id, value), resend: () => resendVoucher(voucher._id, value), extend: () => extendVoucher(voucher._id, value) }[action]
            const res = await call()
            onResult(res.data)
            onDone(res.voucher)
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'That did not work. Try again in a moment.', 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='voucherAction'>
            <label htmlFor={`voucher-${action}-${voucher._id}`}>{label}</label>
            <input id={`voucher-${action}-${voucher._id}`} type={action === 'extend' ? 'date' : action === 'resend' ? 'email' : 'text'}
                value={value} onChange={(e) => setValue(e.target.value)} placeholder={action === 'use' ? 'SBT-…' : undefined} />
            {action === 'use' ? <small className='muted'>Leave it empty to mark it used without linking a booking.</small> : null}
            <div className='voucherActionButtons'>
                <button type='button' className='btn btnSmall' onClick={go} disabled={busy}>{busy ? 'Saving…' : button}</button>
                <button type='button' className='btn btnSmall btnGhost' onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </div>
    )
}

function VouchersPanel({ prices, onResult }) {
    const [vouchers, setVouchers] = useState(null)
    const [problem, setProblem] = useState(null)
    const [query, setQuery] = useState('')
    const [making, setMaking] = useState(false)
    const [form, setForm] = useState(EMPTY)
    const [busy, setBusy] = useState(false)
    const [open, setOpen] = useState(null) // { id, action } for the row being changed
    const [showUsed, setShowUsed] = useState(false)

    const load = async (q = query) => {
        setProblem(null)
        try {
            setVouchers((await listVouchers(q.trim())).vouchers)
        } catch (error) {
            if (error.response?.status !== 401) setProblem('Could not load the vouchers. Try again in a moment.')
        }
    }
    useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
    const people = (Number(form.adults) || 0) + (Number(form.children) || 0)
    const price = !prices ? null : form.kind === 'charter' ? Number(prices.charter) : (Number(form.adults) || 0) * Number(prices.adult) + (Number(form.children) || 0) * Number(prices.child)

    const make = async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
            const res = await addVoucher(form)
            onResult(res.data)
            setForm(EMPTY)
            setMaking(false)
            setQuery('')
            await load('')
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'Could not make the voucher. Try again in a moment.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const quick = async (voucher, call) => {
        try {
            const res = await call()
            onResult(res.data)
            replace(res.voucher)
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'That did not work. Try again in a moment.', 'error')
        }
    }
    const replace = (updated) => {
        if (updated) setVouchers((list) => list.map((v) => (v._id === updated._id ? updated : v)))
        setOpen(null)
    }
    const usedCount = vouchers ? vouchers.filter((v) => v.status === 'used').length : 0
    const shown = vouchers && (showUsed ? vouchers : vouchers.filter((v) => v.status !== 'used'))

    const pdf = async (voucher) => {
        try { await downloadVoucher(voucher) } catch (error) { if (error.response?.status !== 401) onResult('Could not download the PDF. Try again in a moment.', 'error') }
    }

    return (
        <div className='vouchersPanel'>
            <div className='vouchersHead'>
                <h2>Gift vouchers</h2>
                <button type='button' className='btn' onClick={() => setMaking((m) => !m)} aria-expanded={making}>
                    {making ? 'Close' : '+ Make a voucher'}
                </button>
            </div>
            <p className='muted'>
                Vouchers bought online appear here by themselves. Make one here when someone pays by bank transfer or cash, or for a prize.
                When someone books with a voucher, book them in as usual, then press Use and type the booking&apos;s reference.
            </p>

            {making ? (
                <form className='panelForm voucherForm' onSubmit={make}>
                    <h3>Make a voucher</h3>
                    <div className='fieldRow'>
                        <label htmlFor='voucherKind'>Voucher for</label>
                        <select id='voucherKind' value={form.kind} onChange={set('kind')}>
                            <option value='trip'>People on a trip</option>
                            <option value='charter'>A private charter</option>
                        </select>
                    </div>
                    {form.kind === 'trip' ? (
                        <div className='voucherPair'>
                            <div className='fieldRow'>
                                <label htmlFor='voucherAdults'>Adults</label>
                                <input id='voucherAdults' type='number' min='0' max='12' value={form.adults} onChange={set('adults')} />
                            </div>
                            <div className='fieldRow'>
                                <label htmlFor='voucherChildren'>Children</label>
                                <input id='voucherChildren' type='number' min='0' max='12' value={form.children} onChange={set('children')} />
                            </div>
                        </div>
                    ) : null}
                    <div className='fieldRow'>
                        <label htmlFor='voucherFor'>Who it&apos;s for <span className='muted'>(optional)</span></label>
                        <input id='voucherFor' type='text' maxLength='100' value={form.recipientName} onChange={set('recipientName')} />
                    </div>
                    <div className='fieldRow'>
                        <label htmlFor='voucherMessage'>Message on the voucher <span className='muted'>(optional)</span></label>
                        <textarea id='voucherMessage' rows='2' maxLength='300' value={form.message} onChange={set('message')} />
                    </div>
                    <div className='voucherPair'>
                        <div className='fieldRow'>
                            <label htmlFor='voucherBuyer'>Bought by <span className='muted'>(optional)</span></label>
                            <input id='voucherBuyer' type='text' maxLength='100' value={form.buyerName} onChange={set('buyerName')} />
                        </div>
                        <div className='fieldRow'>
                            <label htmlFor='voucherBuyerEmail'>Their email <span className='muted'>(optional)</span></label>
                            <input id='voucherBuyerEmail' type='email' maxLength='254' value={form.buyerEmail} onChange={set('buyerEmail')} />
                        </div>
                    </div>
                    <div className='voucherPair'>
                        <div className='fieldRow'>
                            <label htmlFor='voucherPaidBy'>Paid by</label>
                            <select id='voucherPaidBy' value={form.paidBy} onChange={set('paidBy')}>
                                <option value='bank'>Bank transfer</option>
                                <option value='cash'>Cash</option>
                                <option value='free'>No charge (a prize or gift)</option>
                            </select>
                        </div>
                        {form.paidBy !== 'free' ? (
                            <div className='fieldRow'>
                                <label htmlFor='voucherAmount'>Amount paid, £</label>
                                <input id='voucherAmount' type='text' inputMode='decimal' value={form.amountPaid} onChange={set('amountPaid')}
                                    placeholder={price != null ? String(price) : ''} />
                            </div>
                        ) : null}
                    </div>
                    <div className='fieldRow'>
                        <label htmlFor='voucherExpires'>Valid until <span className='muted'>(empty: 1 October of next season)</span></label>
                        <input id='voucherExpires' type='date' value={form.expiresOn} onChange={set('expiresOn')} />
                    </div>
                    <div className='fieldRow'>
                        <label htmlFor='voucherSendTo'>Email the voucher</label>
                        <select id='voucherSendTo' value={form.sendTo} onChange={set('sendTo')}>
                            <option value='none'>Don&apos;t email it (I&apos;ll print or forward the PDF)</option>
                            <option value='buyer'>To the buyer</option>
                            <option value='recipient'>To the person it&apos;s for</option>
                        </select>
                    </div>
                    {form.sendTo === 'recipient' ? (
                        <div className='voucherPair'>
                            <div className='fieldRow'>
                                <label htmlFor='voucherRecipientEmail'>Their email</label>
                                <input id='voucherRecipientEmail' type='email' maxLength='254' value={form.recipientEmail} onChange={set('recipientEmail')} />
                            </div>
                            <div className='fieldRow'>
                                <label htmlFor='voucherSendOn'>Send on <span className='muted'>(empty: now)</span></label>
                                <input id='voucherSendOn' type='date' value={form.sendOn} onChange={set('sendOn')} />
                            </div>
                        </div>
                    ) : null}
                    <button className='btn' type='submit' disabled={busy || (form.kind === 'trip' && people < 1)}>{busy ? 'Making…' : 'Make the voucher'}</button>
                </form>
            ) : null}

            <form className='vouchersSearch' role='search' onSubmit={(e) => { e.preventDefault(); load() }}>
                <label htmlFor='voucherSearch' className='sr-only'>Search vouchers</label>
                <input id='voucherSearch' type='search' value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Code, name, email or booking reference' />
                <button type='submit' className='btn btnSmall'>Search</button>
                {query ? <button type='button' className='btn btnSmall btnGhost' onClick={() => { setQuery(''); load('') }}>Clear</button> : null}
                <label className='toggle'>
                    <input type='checkbox' checked={showUsed} onChange={(e) => setShowUsed(e.target.checked)} />
                    Show used{usedCount ? ` (${usedCount})` : ''}
                </label>
            </form>

            {problem ? <p className='seasonError' role='alert'>{problem}</p> : null}
            {!problem && !vouchers ? <p className='muted' aria-busy='true'>Loading…</p> : null}
            {vouchers && !vouchers.length ? <p className='emptyState'>{query ? 'No vouchers match.' : 'No gift vouchers yet.'}</p> : null}
            {vouchers?.length && !shown.length ? <p className='emptyState'>{query ? 'Only used vouchers match.' : 'Every voucher has been used.'} Tick Show used to see them.</p> : null}
            {shown?.length ? (
                <div className='tableWrap'>
                    <table className='bookingsTable vouchersTable'>
                        <thead><tr><th>Code</th><th>For</th><th>Covers</th><th>Bought</th><th>Status</th><th><span className='sr-only'>Actions</span></th></tr></thead>
                        <tbody>
                            {shown.map((voucher) => {
                                const status = statusOf(voucher)
                                const editing = open?.id === voucher._id ? open.action : null
                                return (
                                    <tr key={voucher._id}>
                                        <td data-label='Code' className='voucherCodeCell'>{voucher.code}</td>
                                        <td data-label='For'>
                                            {voucher.recipientName || '(no name)'}
                                            {voucher.buyerName ? <small className='muted voucherSub'>from {voucher.buyerName}</small> : null}
                                            {voucher.message ? <small className='muted voucherSub'>&ldquo;{voucher.message}&rdquo;</small> : null}
                                        </td>
                                        <td data-label='Covers'>{voucher.covers}</td>
                                        <td data-label='Bought'>
                                            {madeOn(voucher)}
                                            <small className='muted voucherSub'>{PAID_BY[voucher.paidBy]}{voucher.paidBy !== 'free' ? `, ${formatPounds((voucher.amountPaid || 0) / 100)}` : ''}</small>
                                            {voucher.deliverTo ? <small className='muted voucherSub'>{voucher.sentAt ? `Emailed to ${voucher.deliverTo}` : voucher.sendOn ? `To ${voucher.deliverTo} on ${showDay(voucher.sendOn)}` : `Not emailed yet (${voucher.deliverTo})`}</small> : null}
                                        </td>
                                        <td data-label='Status'>
                                            <span className={`voucherStatus ${status.className}`}>{status.label}</span>
                                            <small className='muted voucherSub'>
                                                {voucher.status === 'used'
                                                    ? (voucher.bookingReference ? `Booking ${voucher.bookingReference}` : 'No booking linked')
                                                    : `${voucher.expired ? 'Expired' : 'Until'} ${showDay(voucher.expiresOn)}`}
                                            </small>
                                        </td>
                                        <td className='actionsCell'>
                                            {editing ? (
                                                <RowAction voucher={voucher} action={editing} onCancel={() => setOpen(null)} onDone={replace} onResult={onResult} />
                                            ) : (<>
                                                {voucher.status === 'unused' && !voucher.expired ? <button type='button' className='btn btnSmall' onClick={() => setOpen({ id: voucher._id, action: 'use' })}>Use</button> : null}
                                                {voucher.status === 'used' ? <button type='button' className='btn btnSmall btnGhost' onClick={() => quick(voucher, () => undoVoucher(voucher._id))}>Undo used</button> : null}
                                                {voucher.status === 'unused' ? <button type='button' className='btn btnSmall btnGhost' onClick={() => setOpen({ id: voucher._id, action: 'extend' })}>Extend</button> : null}
                                                <button type='button' className='btn btnSmall btnGhost' onClick={() => setOpen({ id: voucher._id, action: 'resend' })}>Email</button>
                                                <button type='button' className='btn btnSmall btnGhost' onClick={() => pdf(voucher)}>PDF</button>
                                            </>)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    )
}

export default VouchersPanel
