import { useState, useEffect } from 'react'
import { setSeasonDates } from '../services.jsx/seasonDates.jsx'

// Dates are plain YYYY-MM-DD, so format them in UTC to avoid off-by-one days
const formatDay = (day) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    })

// editing: the dates can only be changed once the owner has pressed Edit in the top bar
function SeasonDatesForm({ savedStart, savedEnd, onSaved, editing }) {

    const [start, setStart] = useState(savedStart)
    const [end, setEnd] = useState(savedEnd)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        setStart(savedStart)
        setEnd(savedEnd)
    }, [savedStart, savedEnd, editing]) // leaving edit mode drops anything typed but not saved

    const changed = start !== savedStart || end !== savedEnd
    const valid = Boolean(start && end && start <= end)

    const save = async (e) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)
        try {
            const res = await setSeasonDates(start, end)
            onSaved(res.seasonStartDate, res.seasonEndDate)
            setMessage({ type: 'success', text: `Saved ${formatDay(res.seasonStartDate)} – ${formatDay(res.seasonEndDate)}` })
        } catch (error) {
            // A 401 is handled globally (logs out), so only show other failures
            setMessage({ type: 'error', text: error.response?.data?.data || 'Could not save season dates' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className='seasonInline' onSubmit={save}>
            <span className='seasonLabel'>Season</span>
            <span className='settingValues'>
                {/* Locked, the dates are plain text: a locked date box is drawn wider on Android and cut the dates off */}
                {!editing ? <span className='settingText'>{start ? formatDay(start) : 'not set'}</span> : null}
                <label className='sr-only' htmlFor='seasonStart'>Season start date</label>
                <input id='seasonStart' type='date' value={start} max={end || undefined} hidden={!editing}
                    onChange={(e) => { setStart(e.target.value); setMessage(null) }} required disabled={!editing} />
                <span aria-hidden='true'>→</span>
                {!editing ? <span className='settingText'>{end ? formatDay(end) : 'not set'}</span> : null}
                <label className='sr-only' htmlFor='seasonEnd'>Season end date</label>
                <input id='seasonEnd' type='date' value={end} min={start || undefined} hidden={!editing}
                    onChange={(e) => { setEnd(e.target.value); setMessage(null) }} required disabled={!editing} />
                {editing ? (
                    <button type='submit' className='btn btnSmall' disabled={!changed || !valid || saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                ) : null}
                {message ? <span role='status' className={message.type === 'success' ? 'seasonSaved' : 'seasonError'}>{message.text}</span> : null}
            </span>
        </form>
    )
}

export default SeasonDatesForm
