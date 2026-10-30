import { useState, useEffect } from 'react'
import { getReport, downloadReport } from '../../services.jsx/prices.jsx'
import { formatPounds } from '../../utils/money.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Passenger and income totals for one month, with a CSV download. selectedDate is the day picked
// on the calendar ('YYYY-MM-DD'); the report starts on that day's month.
function ReportPanel({ selectedDate }) {

    const [year, setYear] = useState(Number(selectedDate.slice(0, 4)))
    const [month, setMonth] = useState(Number(selectedDate.slice(5, 7)))
    const [report, setReport] = useState(null)
    const [problem, setProblem] = useState(null)
    const [downloading, setDownloading] = useState(false)

    const key = `${year}-${String(month).padStart(2, '0')}`
    const thisYear = new Date().getFullYear()
    const years = [...new Set([thisYear - 2, thisYear - 1, thisYear, thisYear + 1, year])].sort()

    useEffect(() => {
        let cancelled = false
        setReport(null)
        setProblem(null)
        getReport(key)
            .then((loaded) => { if (!cancelled) setReport(loaded) })
            .catch((error) => {
                if (cancelled || error.response?.status === 401) return
                setProblem(error.response?.data?.data || 'Could not load the report. Try again in a moment.')
            })
        return () => { cancelled = true }
    }, [key])

    const download = async () => {
        setDownloading(true)
        try {
            await downloadReport(key)
        } catch (error) {
            if (error.response?.status !== 401) setProblem('Could not download the file. Try again in a moment.')
        } finally {
            setDownloading(false)
        }
    }

    const total = report?.total

    return (
        <div className='panelForm'>
            <h2>Monthly report</h2>
            <p className='muted'>
                Passengers and income for one month. Cancelled bookings are left out. Infants are free. Adults, children and infants include
                the people on charters, and each charter is also counted once and earns the charter price.
            </p>
            <div className='fieldRow reportPick'>
                <label htmlFor='reportMonth'>Month</label>
                <select id='reportMonth' value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
                <label className='sr-only' htmlFor='reportYear'>Year</label>
                <select id='reportYear' value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {problem ? <p className='seasonError' role='alert'>{problem}</p> : null}
            {!problem && !total ? <p className='muted' aria-busy='true'>Loading…</p> : null}
            {total ? (
                <dl className='reportStats' aria-label={`Totals for ${MONTHS[month - 1]} ${year}`}>
                    <div><dt>Adults</dt><dd>{total.adults}</dd></div>
                    <div><dt>Children</dt><dd>{total.children}</dd></div>
                    <div><dt>Infants</dt><dd>{total.infants}</dd></div>
                    <div><dt>Passengers</dt><dd>{total.adults + total.children + total.infants}</dd></div>
                    <div><dt>Charters</dt><dd>{total.charters}</dd></div>
                    <div><dt>Income</dt><dd>{formatPounds(total.income / 100)}</dd></div>
                </dl>
            ) : null}

            <button className='btn' type='button' onClick={download} disabled={!total || downloading}>
                {downloading ? 'Preparing…' : 'Download CSV'}
            </button>
        </div>
    )
}

export default ReportPanel
