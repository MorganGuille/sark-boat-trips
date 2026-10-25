import { useState, useEffect } from 'react'
import { getPrices } from '../services.jsx/prices.jsx'

// prices: { adult, child, charter } in pounds, or null if the owner hasn't set them
// status: 'loading' | 'ready' | 'error'
function usePrices() {
    const [status, setStatus] = useState('loading')
    const [prices, setPrices] = useState(null)

    useEffect(() => {
        let cancelled = false
        getPrices()
            .then((loaded) => { if (!cancelled) { setPrices(loaded); setStatus('ready') } })
            .catch((error) => { if (!cancelled) { console.error(error); setStatus('error') } })
        return () => { cancelled = true }
    }, [])

    // Lets the dashboard update the saved prices after a successful save
    const updatePrices = (saved) => {
        setPrices(saved)
        setStatus('ready')
    }

    return { status, prices, updatePrices }
}

export default usePrices
