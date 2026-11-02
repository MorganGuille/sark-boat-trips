import { useState } from 'react'
import { CONTACT_EMAIL, CONTACT_PHONE, PHONE_LINK } from '../utils/contact.js'
import { formatPounds } from '../utils/money.js'
import { toDay } from '../utils/dates.js'
import usePrices from '../hooks/usePrices'
import { startVoucherCheckout } from '../services.jsx/vouchers.jsx'

import '../css/customerBooking.css'
import '../css/giftVouchers.css'

import boat from '../assets/images/gallery2.webp'

// The Gift vouchers page (owner's choices, 2 Nov 2026): a voucher for people on a trip at the normal
// prices, or a private charter, made personal with a name and a message, emailed to the buyer or to
// the person it's for (now or on a day they choose), paid at once on Stripe's page. It looks like the
// booking form (the same − and + buttons and running total). The server checks everything again.

const MAX_PEOPLE = 12
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Stepper({ id, label, hint, value, canAdd, onChange }) {
    return (
        <div className='stepperRow'>
            <label htmlFor={id}>
                {label}
                <span className='stepperHint'>{hint}</span>
            </label>
            <div className='stepper'>
                <button type='button' className='stepBtn' aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= 0}
                    onClick={() => onChange(value - 1)}>−</button>
                <input type='number' id={id} name={id} inputMode='numeric' min='0' max={MAX_PEOPLE} value={value}
                    onChange={(e) => onChange(Math.max(0, Math.min(MAX_PEOPLE, Number(e.target.value) || 0)))} />
                <button type='button' className='stepBtn' aria-label={`More ${label.toLowerCase()}`} disabled={!canAdd}
                    onClick={() => onChange(value + 1)}>+</button>
            </div>
        </div>
    )
}

function GiftVouchers() {
    const { prices, status } = usePrices()
    const [kind, setKind] = useState('trip')
    const [adults, setAdults] = useState(2)
    const [children, setChildren] = useState(0)
    const [details, setDetails] = useState({ recipientName: '', message: '', buyerName: '', buyerEmail: '', recipientEmail: '', sendOn: '' })
    const [sendTo, setSendTo] = useState('buyer')
    const [later, setLater] = useState(false)
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    const people = adults + children
    const onSale = status !== 'ready' || Boolean(prices)
    const total = !prices ? null : kind === 'charter' ? Number(prices.charter) : adults * Number(prices.adult) + children * Number(prices.child)
    const covers = kind === 'charter' ? 'Private charter' : [adults ? plural(adults, 'adult', 'adults') : null, children ? plural(children, 'child', 'children') : null].filter(Boolean).join(' and ')
    const ready = kind === 'charter' || people > 0
    const setDetail = (key) => (e) => setDetails((d) => ({ ...d, [key]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        if (!ready) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await startVoucherCheckout({
                kind, adults: String(adults), children: String(children), ...details, sendTo,
                sendOn: sendTo === 'recipient' && later ? details.sendOn : '',
                website_url: e.target.website_url?.value, // the hidden field only bots fill in
            })
            if (res.url) {
                window.location.href = res.url // Stripe's page; the voucher is made once it's paid
                return
            }
            setError(res.data)
        } catch (err) {
            setError(err.response?.data?.data || "Sorry, we couldn't open the payment page. Nothing has been charged. Please try again, or contact us.")
        } finally {
            setSubmitting(false)
        }
    }

    return (<>
        <title>Sark Boat Trips | Gift Vouchers</title>
        <meta name="description" content="Give a boat trip around Sark: gift vouchers for any number of people, or a private charter, emailed straight away or on a day you choose. Valid for the whole of next season." />
        <main id="main-content" className='giftPage'>
            <header className='giftHero' style={{ backgroundImage: `url(${boat})` }}>
                <div className='giftHeroText'>
                    <h1>Gift vouchers</h1>
                    <p>Give a boat trip around Sark: the caves, the cliffs and the seabirds, with a local skipper.</p>
                </div>
            </header>

            <div className='giftBody'>
                <section className='giftAbout' aria-labelledby='gift-about'>
                    <h2 id='gift-about'>How it works</h2>
                    <ul>
                        <li>Choose a trip for any number of people, or a private charter for up to {MAX_PEOPLE}</li>
                        <li>Add their name and a message, and we&apos;ll put them on the voucher</li>
                        <li>It&apos;s emailed to you, or straight to them on a day you choose, as a PDF to print or forward</li>
                        <li>Valid for the whole of next season, until 1 October</li>
                        <li>To use it, they contact us with the code and we find them a day</li>
                        <li>It can be passed on to someone else, but it can&apos;t be refunded</li>
                    </ul>
                    <p className='giftContact'>Questions? Call or WhatsApp <a href={PHONE_LINK}>{CONTACT_PHONE}</a> or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                </section>

                <section className='customerBooking giftForm' aria-label='Buy a gift voucher'>
                    {!onSale ? (
                        <p className='formError' role='status'>Gift vouchers will be on sale soon. In the meantime, please contact us.</p>
                    ) : (
                        <form onSubmit={submit}>
                            <fieldset className='bookStep'>
                                <legend><span className='stepNumber'>1</span> Choose a voucher</legend>
                                <div className='tripCards giftChoice'>
                                    <label className={`tripCard${kind === 'trip' ? ' selected' : ''}`}>
                                        <input type='radio' name='kind' value='trip' checked={kind === 'trip'} onChange={() => setKind('trip')} />
                                        <span className='tripCardMain'>
                                            <span className='tripCardTime'><strong>A boat trip</strong></span>
                                            <span className='tripCardSpaces'>{prices ? `${formatPounds(Number(prices.adult))} an adult, ${formatPounds(Number(prices.child))} a child` : 'for each person'}</span>
                                        </span>
                                    </label>
                                    <label className={`tripCard${kind === 'charter' ? ' selected' : ''}`}>
                                        <input type='radio' name='kind' value='charter' checked={kind === 'charter'} onChange={() => setKind('charter')} />
                                        <span className='tripCardMain'>
                                            <span className='tripCardTime'><strong>Private charter</strong></span>
                                            <span className='tripCardSpaces'>{prices ? `${formatPounds(Number(prices.charter))}, ` : ''}the whole boat for up to {MAX_PEOPLE}</span>
                                        </span>
                                    </label>
                                </div>
                                {kind === 'trip' ? (<>
                                    <Stepper id='adults' label='Adults' hint='15 and over' value={adults} canAdd={people < MAX_PEOPLE} onChange={setAdults} />
                                    <Stepper id='children' label='Children' hint='4 to 14' value={children} canAdd={people < MAX_PEOPLE} onChange={setChildren} />
                                    <p className='muted giftNote'>Children 3 and under go free, so they don&apos;t need a voucher.</p>
                                </>) : null}
                                {total != null && ready ? (
                                    <p className='priceTotal' aria-live='polite'>
                                        <span>Total <strong>{formatPounds(total)}</strong></span>
                                        <span className='priceBreakdown'>{covers}</span>
                                    </p>
                                ) : null}
                                {!ready ? <p className='partyProblem' role='alert'>Please choose at least one person.</p> : null}
                            </fieldset>

                            <fieldset className='bookStep'>
                                <legend><span className='stepNumber'>2</span> Make it personal</legend>
                                <label>Who is it for?
                                    <input type='text' id='recipientName' name='recipientName' value={details.recipientName} onChange={setDetail('recipientName')} required maxLength='100' placeholder='e.g. Jane, or Mum and Dad' />
                                </label>
                                <label>A message <span className='fieldHint'>optional, printed on the voucher</span>
                                    <textarea id='message' name='message' rows='3' value={details.message} onChange={setDetail('message')} maxLength='300' />
                                </label>
                            </fieldset>

                            <fieldset className='bookStep'>
                                <legend><span className='stepNumber'>3</span> Where should we send it?</legend>
                                <div className='giftToggle' role='radiogroup' aria-label='Where should we send it?'>
                                    <label className={sendTo === 'buyer' ? 'on' : ''}>
                                        <input type='radio' name='sendTo' value='buyer' checked={sendTo === 'buyer'} onChange={() => setSendTo('buyer')} />
                                        Email it to me
                                    </label>
                                    <label className={sendTo === 'recipient' ? 'on' : ''}>
                                        <input type='radio' name='sendTo' value='recipient' checked={sendTo === 'recipient'} onChange={() => setSendTo('recipient')} />
                                        Email it to them
                                    </label>
                                </div>
                                {sendTo === 'recipient' ? (<>
                                    <label>Their email
                                        <input type='email' id='recipientEmail' name='recipientEmail' value={details.recipientEmail} onChange={setDetail('recipientEmail')} required inputMode='email' maxLength='254' />
                                    </label>
                                    <div className='giftToggle' role='radiogroup' aria-label='When should we send it?'>
                                        <label className={!later ? 'on' : ''}>
                                            <input type='radio' name='when' value='now' checked={!later} onChange={() => setLater(false)} />
                                            Straight away
                                        </label>
                                        <label className={later ? 'on' : ''}>
                                            <input type='radio' name='when' value='later' checked={later} onChange={() => setLater(true)} />
                                            On a day I choose
                                        </label>
                                    </div>
                                    {later ? (
                                        <label>Send it on <span className='fieldHint'>in the morning, UK time</span>
                                            <input type='date' id='sendOn' name='sendOn' value={details.sendOn} onChange={setDetail('sendOn')} required min={toDay(new Date())} />
                                        </label>
                                    ) : null}
                                    <p className='muted giftNote'>We&apos;ll email you a receipt and a copy of the voucher too.</p>
                                </>) : null}
                            </fieldset>

                            <fieldset className='bookStep'>
                                <legend><span className='stepNumber'>4</span> Your details</legend>
                                <label>Your name
                                    <input type='text' id='buyerName' name='buyerName' value={details.buyerName} onChange={setDetail('buyerName')} required autoComplete='name' maxLength='100' />
                                </label>
                                <label>Your email
                                    <input type='email' id='buyerEmail' name='buyerEmail' value={details.buyerEmail} onChange={setDetail('buyerEmail')} required autoComplete='email' inputMode='email' maxLength='254' />
                                </label>
                            </fieldset>

                            {/* Hidden from people (off-screen, skipped by Tab and screen readers); bots tend to fill it in */}
                            <div aria-hidden='true' className='honeypot'>
                                <label htmlFor='website_url'>Leave this field empty</label>
                                <input type='text' id='website_url' name='website_url' tabIndex={-1} autoComplete='off' />
                            </div>

                            {error ? <p className='formError' role='alert'>{error}</p> : null}

                            <button className='continueBtn' type='submit' disabled={submitting || !ready || total == null}>
                                {submitting ? 'Opening the payment page…' : total != null && ready ? `Continue to payment (${formatPounds(total)})` : 'Continue to payment'}
                            </button>
                            <p className='cardNotice'>
                                Next you&apos;ll pay on Stripe&apos;s secure page. The voucher can be passed on to someone else, but it
                                can&apos;t be refunded. <a href='/terms' target='_blank' rel='noopener'>Terms and conditions</a>
                            </p>
                        </form>
                    )}
                </section>
            </div>
        </main>
    </>)
}

export default GiftVouchers
