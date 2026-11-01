import { useState, useEffect } from 'react'
import { setPrices } from '../services.jsx/prices.jsx'
import { formatPounds } from '../utils/money.js'

const text = (pounds) => (pounds === undefined || pounds === null ? '' : String(pounds))

// The three ticket prices, in the dashboard's top row next to the season dates. Infants are free.
// editing: the prices can only be changed once the owner has pressed Edit in the top bar
function PricesForm({ saved, onSaved, editing }) {

    const [adult, setAdult] = useState(text(saved?.adult))
    const [child, setChild] = useState(text(saved?.child))
    const [charter, setCharter] = useState(text(saved?.charter))
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        setAdult(text(saved?.adult))
        setChild(text(saved?.child))
        setCharter(text(saved?.charter))
    }, [saved, editing]) // leaving edit mode drops anything typed but not saved

    const changed = adult !== text(saved?.adult) || child !== text(saved?.child) || charter !== text(saved?.charter)
    const filled = adult !== '' && child !== '' && charter !== ''

    const save = async (e) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)
        try {
            const res = await setPrices(adult, child, charter)
            onSaved(res.prices)
            setMessage({ type: 'success', text: `Saved: adult ${formatPounds(res.prices.adult)}, child ${formatPounds(res.prices.child)}, charter ${formatPounds(res.prices.charter)}` })
        } catch (error) {
            // A 401 is handled globally (logs out), so only show other failures
            setMessage({ type: 'error', text: error.response?.data?.data || 'Could not save prices' })
        } finally {
            setSaving(false)
        }
    }

    const field = (id, label, value, setValue) => (
        <span className='priceField'>
            <label htmlFor={id}>{label}</label>
            <span className='priceBox'>£<input id={id} type='number' inputMode='decimal' min='0' max='10000' step='0.01'
                value={value} onChange={(e) => { setValue(e.target.value); setMessage(null) }} required disabled={!editing} /></span>
        </span>
    )

    return (
        <form className='seasonInline' onSubmit={save}>
            <span className='seasonLabel'>Prices</span>
            <span className={`settingValues priceValues${editing ? ' editing' : ''}`}>
                {field('priceAdult', 'Adult', adult, setAdult)}
                {field('priceChild', 'Child', child, setChild)}
                {field('priceCharter', 'Charter', charter, setCharter)}
                {editing ? (
                    <button type='submit' className='btn btnSmall' disabled={!changed || !filled || saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                ) : null}
                {message ? <span role='status' className={message.type === 'success' ? 'seasonSaved' : 'seasonError'}>{message.text}</span> : null}
            </span>
        </form>
    )
}

export default PricesForm
