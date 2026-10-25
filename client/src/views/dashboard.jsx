import { useEffect, useState } from 'react'
import axios from 'axios'
import MyCalendar from '../components/myCalendar'
import BookingForm from '../components/bookingForm'
import SeasonDatesForm from '../components/seasonDatesForm'
import LoginForm from '../components/dashboard/loginForm'
import BookingsTable from '../components/dashboard/bookingsTable'
import AvailabilityForm from '../components/dashboard/availabilityForm'
import NotesPanel from '../components/dashboard/notesPanel'
import useSeasonDates from '../hooks/useSeasonDates'
import { URL } from '../../config.js'
import { authAxios, setToken, clearToken, hasValidToken, LOGOUT_EVENT } from '../services.jsx/auth.jsx'
import { toDay, showDay, prettyDate } from '../utils/dates.js'

import '../css/dashboard.css'

const TABS = [
    { id: 'bookings', label: 'Bookings' },
    { id: 'new', label: 'New booking' },
    { id: 'availability', label: 'Availability' },
    { id: 'notes', label: 'Notes' },
]

const TIMESLOTS = ['11am', '2pm']

const sortBookings = (bookings) =>
    [...bookings].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '') || // YYYY-MM-DD text is already in date order
        TIMESLOTS.indexOf(a.timeslot) - TIMESLOTS.indexOf(b.timeslot) ||
        (a.status === 'cancelled') - (b.status === 'cancelled') ||
        (a.lastName || '').localeCompare(b.lastName || ''))

// The search endpoint treats the term as a regex, so match what was typed literally
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Dashboard() {

    const [loggedin, setLoggedIn] = useState(hasValidToken)
    const [loginError, setLoginError] = useState('')
    const [selectedDate, setSelectedDate] = useState(() => toDay(new Date()))
    const [tab, setTab] = useState('bookings')
    const [view, setView] = useState({ type: 'date' })
    const [searchTerm, setSearchTerm] = useState('')
    const [showCancelled, setShowCancelled] = useState(false)
    const [bookings, setBookings] = useState([])
    const [bookingsStatus, setBookingsStatus] = useState('loading')
    const [editing, setEditing] = useState(null)
    const [notes, setNotes] = useState([])
    const [notice, setNotice] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [notesKey, setNotesKey] = useState(0)
    const season = useSeasonDates()

    useEffect(() => {
        const onLogout = () => setLoggedIn(false)
        window.addEventListener(LOGOUT_EVENT, onLogout)
        return () => window.removeEventListener(LOGOUT_EVENT, onLogout)
    }, [])

    // Bookings for the selected day, or search results
    useEffect(() => {
        if (!loggedin) return
        let cancelled = false

        const loadBookings = async () => {
            setBookingsStatus('loading')
            try {
                const path = view.type === 'search'
                    ? `search/${encodeURIComponent(escapeRegex(view.term))}`
                    : selectedDate
                const res = await authAxios.get(`${URL}/bookings/${path}`, { params: showCancelled ? { includeCancelled: true } : {} })
                if (cancelled) return
                setBookings(sortBookings(res.data.data))
                setBookingsStatus('ready')
            } catch (error) {
                if (cancelled) return
                console.error(error)
                setBookings([])
                setBookingsStatus('error')
            }
        }
        loadBookings()

        return () => { cancelled = true }
    }, [loggedin, view, selectedDate, showCancelled, refreshKey])

    useEffect(() => {
        if (!loggedin) return
        let cancelled = false

        const loadNotes = async () => {
            try {
                const res = await authAxios.get(`${URL}/notes/${selectedDate}`)
                if (!cancelled) setNotes(res.data.data)
            } catch (error) {
                if (cancelled) return
                console.error('Error fetching notes', error)
                setNotes([])
            }
        }
        loadNotes()

        return () => { cancelled = true }
    }, [loggedin, selectedDate, notesKey])

    const showNotice = (text, type = 'success') => setNotice({ text, type })
    const refreshBookings = () => setRefreshKey((key) => key + 1)

    const login = async (userName, password) => {
        try {
            const response = await axios.post(`${URL}/admin/login`, { userName, password })
            setToken(response.data.token)
            setLoginError('')
            setLoggedIn(true)
        } catch (error) {
            setLoginError(error.response?.status === 429
                ? 'Too many attempts, try again in 15 minutes'
                : 'Incorrect username or password')
        }
    }

    const logout = () => {
        clearToken()
        setLoggedIn(false)
    }

    const changeTab = (id) => {
        setTab(id)
        setEditing(null)
        setNotice(null)
    }

    const search = (e) => {
        e.preventDefault()
        const term = searchTerm.trim()
        setView(term ? { type: 'search', term } : { type: 'date' })
    }

    const clearSearch = () => {
        setSearchTerm('')
        setView({ type: 'date' })
    }

    const bookingAction = async (path, booking) => {
        try {
            const res = await authAxios.post(`${URL}/bookings/${path}`, { _id: booking._id })
            showNotice(res.data.data, res.data.ok === false ? 'error' : 'success')
        } catch (error) {
            if (error.response?.status === 401) return
            showNotice(error.response?.data?.data || 'Something went wrong', 'error')
        } finally {
            refreshBookings()
        }
    }

    const describe = (booking) => {
        const who = [booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'this booking'
        return `${who} on ${showDay(booking.date)} at ${booking.timeslot}`
    }

    const cancelBooking = (booking) => {
        const emailNote = booking.email ? 'The customer will be emailed a cancellation.' : 'There is no email address, so no cancellation will be sent.'
        if (window.confirm(`Cancel the booking for ${describe(booking)}?\n\n${emailNote}\nYou can restore it later using "Show cancelled".`)) {
            bookingAction('cancel', booking)
        }
    }

    const restoreBooking = (booking) => {
        const emailNote = booking.email ? 'The customer will be sent a new confirmation email.' : 'There is no email address, so no confirmation will be sent.'
        if (window.confirm(`Restore the booking for ${describe(booking)}?\n\n${emailNote}`)) {
            bookingAction('restore', booking)
        }
    }

    const deletePermanently = (booking) => {
        if (window.confirm(`Permanently delete the booking for ${describe(booking)}?\n\nThis removes the booking record for good and cannot be undone.`)) {
            bookingAction('permanently-delete', booking)
        }
    }

    const addNote = async (content) => {
        try {
            await authAxios.post(`${URL}/notes`, { date: selectedDate, content })
            setNotesKey((key) => key + 1)
            return true
        } catch (error) {
            if (error.response?.status !== 401) showNotice(error.response?.data?.message || 'Failed to add note', 'error')
            return false
        }
    }

    const deleteNote = async (note) => {
        try {
            await authAxios.delete(`${URL}/notes/${note._id}`)
            showNotice('Note deleted')
        } catch (error) {
            if (error.response?.status !== 401) showNotice(error.response?.data?.message || 'Failed to delete note', 'error')
        } finally {
            setNotesKey((key) => key + 1)
        }
    }

    const bookingSaved = () => {
        setEditing(null)
        refreshBookings()
    }

    if (!loggedin) {
        return (<>
            <title>Sark Boat Trips | Dashboard</title>
            <div className='dashboard'>
                <LoginForm error={loginError} onLogin={login} />
            </div>
        </>)
    }

    const activeBookings = bookings.filter((b) => b.status !== 'cancelled')
    const cancelledCount = bookings.length - activeBookings.length
    const guestCount = activeBookings.reduce((sum, b) => sum + (Number(b.adults) || 0) + (Number(b.children) || 0), 0)
    const searching = view.type === 'search'

    return (<>
        <title>Sark Boat Trips | Dashboard</title>
        <div className='dashboard'>
            <header className='dashHeader dashCard'>
                <h1>Dashboard</h1>
                <SeasonDatesForm savedStart={season.start} savedEnd={season.end} onSaved={season.updateDates} />
                <button className='btn btnSmall btnGhost' onClick={logout}>Log out</button>
            </header>

            <div className='dashGrid'>
                <aside className='dashSide dashCard' aria-label='Calendar'>
                    <MyCalendar setSelectedDate={setSelectedDate} seasonStartDate={season.start}
                        seasonEndDate={season.end} refreshKey={refreshKey}
                    />
                </aside>

                <main className='dashMain dashCard'>
                    <div className='dashTabs' role='tablist' aria-label='Dashboard sections'>
                        {TABS.map(({ id, label }) => (
                            <button key={id} id={`tab-${id}`} role='tab' type='button'
                                aria-selected={tab === id} aria-controls={`panel-${id}`}
                                className='dashTab' onClick={() => changeTab(id)}>
                                {label}{id === 'notes' && notes.length ? <span className='count'>{notes.length}</span> : null}
                            </button>
                        ))}
                    </div>

                    {notice ? (
                        <div role='status' className={`notice ${notice.type}`}>
                            <span>{notice.text}</span>
                            <button type='button' aria-label='Dismiss message' onClick={() => setNotice(null)}>×</button>
                        </div>
                    ) : null}

                    <div className='dashPanel' role='tabpanel' id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>

                        {tab === 'bookings' && editing ? (<>
                            <button type='button' className='btnLink' onClick={() => setEditing(null)}>← Back to bookings</button>
                            <BookingForm key={editing._id} selectedDate={selectedDate} booking={editing}
                                onResult={showNotice} onDone={bookingSaved} />
                        </>) : null}

                        {tab === 'bookings' && !editing ? (<>
                            <div className='panelHead'>
                                <div>
                                    <h2>{searching ? `Results for “${view.term}”` : prettyDate(selectedDate)}</h2>
                                    <p className='muted'>
                                        {bookingsStatus === 'ready'
                                            ? (bookings.length
                                                ? [
                                                    activeBookings.length
                                                        ? `${activeBookings.length} booking${activeBookings.length === 1 ? '' : 's'} · ${guestCount} guest${guestCount === 1 ? '' : 's'}`
                                                        : 'No active bookings',
                                                    cancelledCount ? `${cancelledCount} cancelled` : null,
                                                ].filter(Boolean).join(' · ')
                                                : 'No bookings')
                                            : ' '}
                                    </p>
                                </div>
                                <div className='bookingsTools'>
                                <label className='toggle'>
                                    <input type='checkbox' checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
                                    Show cancelled
                                </label>
                                <form className='searchForm' onSubmit={search} role='search'>
                                    <label className='sr-only' htmlFor='lastNameSearch'>Search by last name</label>
                                    <input id='lastNameSearch' type='search' placeholder='Search by last name'
                                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    <button type='submit' className='btn btnSmall'>Search</button>
                                    {searching ? <button type='button' className='btn btnSmall btnGhost' onClick={clearSearch}>Back to day</button> : null}
                                </form>
                                </div>
                            </div>

                            {bookingsStatus === 'loading' ? <p className='muted' aria-busy='true'>Loading bookings…</p> : null}
                            {bookingsStatus === 'error' ? <p className='seasonError' role='alert'>Could not load bookings. Try again in a moment.</p> : null}
                            {bookingsStatus === 'ready' && bookings.length ? (
                                <BookingsTable bookings={bookings} showDate={searching}
                                    onEdit={setEditing} onCancel={cancelBooking}
                                    onRestore={restoreBooking} onDeletePermanently={deletePermanently} />
                            ) : null}
                            {bookingsStatus === 'ready' && !bookings.length ? (
                                <p className='emptyState'>{searching ? 'No bookings found with that last name.' : 'Nothing booked for this day yet.'}</p>
                            ) : null}

                            {!searching && notes.length ? (
                                <div className='dayNote'>
                                    <strong>Notes</strong>
                                    <button type='button' className='btnLink' onClick={() => changeTab('notes')}>Manage</button>
                                    {notes.map((note) => <p key={note._id}>{note.content}</p>)}
                                </div>
                            ) : null}
                        </>) : null}

                        {tab === 'new' ? (
                            <BookingForm selectedDate={selectedDate} onResult={showNotice} onDone={refreshBookings} />
                        ) : null}

                        {tab === 'availability' ? (
                            <AvailabilityForm selectedDate={selectedDate} onResult={showNotice} onDone={refreshBookings} />
                        ) : null}

                        {tab === 'notes' ? (
                            <NotesPanel selectedDate={selectedDate} notes={notes} onAdd={addNote} onDelete={deleteNote} />
                        ) : null}
                    </div>
                </main>
            </div>
        </div>
    </>)
}

export default Dashboard
