import { useState, useEffect } from 'react'
import { getSeasonDates } from '../services.jsx/seasonDates.jsx'

// status: 'loading' | 'ready' | 'notSet' | 'error'
function useSeasonDates() {
    const [status, setStatus] = useState('loading')
    const [dates, setDates] = useState({ start: '', end: '' })

    useEffect(() => {
        let cancelled = false

        const fetchDates = async () => {
            try {
                const res = await getSeasonDates()
                if (cancelled) return
                setDates({ start: res.seasonStartDate, end: res.seasonEndDate })
                setStatus('ready')
            } catch (error) {
                if (cancelled) return
                if (error.response?.status === 404) {
                    setStatus('notSet')
                } else {
                    console.error(error)
                    setStatus('error')
                }
            }
        }
        fetchDates()

        return () => { cancelled = true }
    }, [])

    // Lets the dashboard update the saved dates after a successful save
    const updateDates = (start, end) => {
        setDates({ start, end })
        setStatus('ready')
    }

    return { status, start: dates.start, end: dates.end, updateDates }
}

export default useSeasonDates
