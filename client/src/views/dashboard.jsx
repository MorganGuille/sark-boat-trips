import { useEffect, useState } from 'react'
import axios from 'axios'
import MyCalendar from '../components/myCalendar'
import BookingForm from '../components/bookingForm'
import SeasonDatesForm from '../components/seasonDatesForm'
import PricesForm from '../components/pricesForm'
import ReportPanel from '../components/dashboard/reportPanel'
import VouchersPanel from '../components/dashboard/vouchersPanel'
import CancelTripForm from '../components/dashboard/cancelTripForm'
import ChangeTripForm from '../components/dashboard/changeTripForm'
import MessageTripForm from '../components/dashboard/messageTripForm'
import BookingsByDay from '../components/dashboard/bookingsByDay'
import AddTripForm from '../components/dashboard/addTripForm'
import LoginForm from '../components/dashboard/loginForm'
import BookingsTable from '../components/dashboard/bookingsTable'
import AvailabilityForm from '../components/dashboard/availabilityForm'
import NotesPanel from '../components/dashboard/notesPanel'
import CustomerData from '../components/dashboard/customerData'
import UndoBar from '../components/dashboard/undoBar'
import { useConfirm } from '../hooks/useConfirm'
import useSeasonDates from '../hooks/useSeasonDates'
import usePrices from '../hooks/usePrices'
import { URL } from '../../config.js'
import { authAxios, setToken, clearToken, hasValidToken, LOGOUT_EVENT, TOKEN_KEY } from '../services.jsx/auth.jsx'
import { toDay, prettyDate } from '../utils/dates.js'
import { getDayTrips, USUAL_TRIPS } from '../services.jsx/trips.jsx'

import '../css/dashboard.css'

const TABS = [
    { id: 'bookings', label: 'Bookings' },
    { id: 'tools', label: 'Trip tools' },
    { id: 'new', label: 'New booking' },
    { id: 'availability', label: 'Availability' },
    { id: 'extra', label: 'Extra trips' },
    { id: 'vouchers', label: 'Vouchers' },
    { id: 'notes', label: 'Notes' },
    { id: 'report', label: 'Report' },
]

const sortBookings = (bookings) =>
    [...bookings].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '') || // YYYY-MM-DD text is already in date order
        (a.tripStart || '').localeCompare(b.tripStart || '') || // then by the trip's time that day ('16:30')
        (a.status === 'cancelled') - (b.status === 'cancelled') ||
        (a.lastName || '').localeCompare(b.lastName || ''))

// How far ahead the upcoming list looks (GET /bookings/upcoming?days=...)
const UPCOMING_CHOICES = [['7', 'Next 7 days'], ['14', 'Next 14 days'], ['30', 'Next 30 days'], ['all', 'All upcoming']]

function Dashboard() {

    const [loggedin, setLoggedIn] = useState(hasValidToken)
    const [loginError, setLoginError] = useState('')
    const [selectedDate, setSelectedDate] = useState(() => toDay(new Date()))
    const [tab, setTab] = useState('bookings')
    // What the Bookings tab shows: the chosen day, the upcoming bookings, or search results (spec P2-3)
    const [view, setView] = useState({ type: 'date' })
    const [upcomingDays, setUpcomingDays] = useState('7')
    const [searchTerm, setSearchTerm] = useState('')
    const [searchFrom, setSearchFrom] = useState('')
    const [searchTo, setSearchTo] = useState('')
    const [bookingsError, setBookingsError] = useState('')
    const [showCancelled, setShowCancelled] = useState(false)
    const [bookings, setBookings] = useState([])
    const [bookingsStatus, setBookingsStatus] = useState('loading')
    const [editing, setEditing] = useState(null)
    const [notes, setNotes] = useState([])
    const [notice, setNotice] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [trips, setTrips] = useState(USUAL_TRIPS) // the day's trips as they are that day
    const [notesKey, setNotesKey] = useState(0)
    const season = useSeasonDates()
    const { prices, updatePrices } = usePrices()
    const [editingSettings, setEditingSettings] = useState(false) // season dates and prices are locked until Edit is pressed
    const [undo, setUndo] = useState(null) // the booking just cancelled, while its Undo bar shows
    const confirm = useConfirm()

    useEffect(() => {
        const onLogout = () => setLoggedIn(false)
        // Logging out in another tab logs this one out straight away, not at its next request
        const onStorage = (e) => { if (e.key === null || (e.key === TOKEN_KEY && !e.newValue)) onLogout() }
        window.addEventListener(LOGOUT_EVENT, onLogout)
        window.addEventListener('storage', onStorage)
        return () => {
            window.removeEventListener(LOGOUT_EVENT, onLogout)
            window.removeEventListener('storage', onStorage)
        }
    }, [])

    // Bookings for the selected day, the upcoming list, or search results
    useEffect(() => {
        if (!loggedin) return
        let cancelled = false

        const loadBookings = async () => {
            setBookingsStatus('loading')
            setBookingsError('')
            const params = showCancelled ? { includeCancelled: true } : {}
            const [path, extra] = view.type === 'search' ? ['search', { q: view.term || undefined, from: view.from || undefined, to: view.to || undefined }]
                : view.type === 'upcoming' ? ['upcoming', { days: upcomingDays }]
                    : [selectedDate, {}]
            try {
                const res = await authAxios.get(`${URL}/bookings/${path}`, { params: { ...params, ...extra } })
                if (cancelled) return
                setBookings(sortBookings(res.data.data))
                setBookingsStatus('ready')
            } catch (error) {
                if (cancelled) return
                console.error(error)
                setBookings([])
                setBookingsError(error.response?.status === 400 ? error.response.data?.data || '' : '')
                setBookingsStatus('error')
            }
        }
        loadBookings()

        return () => { cancelled = true }
    }, [loggedin, view, upcomingDays, selectedDate, showCancelled, refreshKey])

    // The selected day's trips: the owner may have moved one to another time or harbour
    useEffect(() => {
        if (!loggedin) return
        let cancelled = false
        getDayTrips(selectedDate)
            .then((dayTrips) => { if (!cancelled) setTrips(dayTrips) })
            .catch(() => { if (!cancelled) setTrips(USUAL_TRIPS) })
        return () => { cancelled = true }
    }, [loggedin, selectedDate, refreshKey])
    const movedTrips = trips.filter((trip) => trip.timeChanged || trip.harbourChanged)

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
        setUndo(null)
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
        setEditing(null)
        setView(term || searchFrom || searchTo ? { type: 'search', term, from: searchFrom, to: searchTo } : { type: 'date' })
    }

    // Back to the day picked on the calendar, forgetting the search
    const clearSearch = () => {
        setSearchTerm('')
        setSearchFrom('')
        setSearchTo('')
        setEditing(null)
        setView({ type: 'date' })
    }

    // Open day, from the upcoming list or search results: that day, with its Edit, Mark paid and Cancel buttons
    const openDay = (date) => {
        clearSearch()
        setSelectedDate(date)
    }

    // Returns whether it worked, so Cancel knows to offer Undo
    const bookingAction = async (path, booking) => {
        try {
            const res = await authAxios.post(`${URL}/bookings/${path}`, { _id: booking._id })
            showNotice(res.data.data, res.data.ok === false ? 'error' : 'success')
            return res.data.ok !== false
        } catch (error) {
            if (error.response?.status === 401) return false
            showNotice(error.response?.data?.data || 'Something went wrong', 'error')
            return false
        } finally {
            refreshBookings()
        }
    }

    // The booking as the confirm box shows it: who, then the day and trip
    const facts = (booking) => [
        [booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'No name',
        `${prettyDate(booking.date)}, ${booking.tripLabel || booking.timeslot}${booking.reference ? ` · ${booking.reference}` : ''}`,
    ]

    // Cancelled at once; the emails wait about a minute, so Undo puts it back without anyone being told
    const cancelBooking = async (booking) => {
        const ok = await confirm({
            title: 'Cancel this booking?', details: facts(booking), danger: true, yes: 'Yes, cancel it', no: 'Keep it',
            body: [
                booking.email ? 'The customer is emailed that it is cancelled in about a minute, unless you press Undo.' : 'There is no email address, so the customer won\'t be told.',
                booking.paymentStatus === 'card_saved' ? 'Their card won\'t be charged.' : null,
                'You can also restore it later under Show cancelled.',
            ],
        })
        if (ok && await bookingAction('cancel', booking)) setUndo({ booking, at: Date.now() })
    }

    const undoCancel = async () => {
        const { booking } = undo
        setUndo(null)
        await bookingAction('restore', booking)
    }

    const restoreBooking = async (booking) => {
        const ok = await confirm({
            title: 'Restore this booking?', details: facts(booking), yes: 'Restore it', no: 'Go back',
            body: [booking.email ? 'The customer will be sent a new confirmation email.' : 'There is no email address, so no confirmation will be sent.'],
        })
        if (ok) bookingAction('restore', booking)
    }

    const markPaid = async (booking) => {
        const ok = await confirm({
            title: 'Mark as paid in person?', details: facts(booking), yes: 'Mark paid', no: 'Go back',
            body: ['Cash or the card reader.', booking.paymentStatus === 'card_saved' ? 'Their saved card will then not be charged.' : null],
        })
        if (ok) bookingAction('mark-paid', booking)
    }

    const markUnpaid = async (booking) => {
        const ok = await confirm({ title: 'Undo "paid"?', details: facts(booking), yes: 'Undo paid', no: 'Go back' })
        if (ok) bookingAction('mark-unpaid', booking)
    }

    const deletePermanently = async (booking) => {
        const ok = await confirm({
            title: 'Delete this booking for good?', details: facts(booking), danger: true, yes: 'Delete for good', no: 'Keep it',
            body: ['This removes the booking record for good and cannot be undone.'],
        })
        if (ok) bookingAction('permanently-delete', booking)
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
    const guestCount = activeBookings.reduce((sum, b) => sum + (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0), 0)
    const searching = view.type === 'search'
    const dayView = view.type === 'date' // the day's bookings are loaded (not the upcoming list or search results)

    return (<>
        <title>Sark Boat Trips | Dashboard</title>
        <div className='dashboard'>
            <header className='dashHeader dashCard'>
                <h1>Dashboard</h1>
                <SeasonDatesForm savedStart={season.start} savedEnd={season.end} onSaved={season.updateDates} editing={editingSettings} />
                <PricesForm saved={prices} onSaved={updatePrices} editing={editingSettings} />
                <button type='button' className='btn btnSmall btnGhost' aria-pressed={editingSettings}
                    aria-label={editingSettings ? 'Done editing season dates and prices' : 'Edit season dates and prices'}
                    onClick={() => setEditingSettings(!editingSettings)}>
                    {editingSettings ? 'Done' : 'Edit'}
                </button>
                <button className='btn btnSmall btnGhost' onClick={logout}>Log out</button>
            </header>

            <div className='dashGrid'>
                <aside className='dashSide dashCard' aria-label='Calendar'>
                    <MyCalendar setSelectedDate={setSelectedDate} seasonStartDate={season.start}
                        seasonEndDate={season.end} refreshKey={refreshKey} value={selectedDate}
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
                            <div className='viewSwitch' role='group' aria-label='Show bookings for'>
                                <button type='button' aria-pressed={dayView} onClick={clearSearch}>Day</button>
                                <button type='button' aria-pressed={view.type === 'upcoming'}
                                    onClick={() => { clearSearch(); setView({ type: 'upcoming' }) }}>Upcoming</button>
                            </div>
                            <div className='panelHead'>
                                <div>
                                    <h2>{view.type === 'upcoming' ? 'Upcoming bookings'
                                        : searching ? (view.term ? `Results for “${view.term}”` : 'Bookings by date')
                                            : prettyDate(selectedDate)}</h2>
                                    <p className='muted'>
                                        {[
                                            view.type === 'upcoming' ? 'From today' : null,
                                            searching && (view.from || view.to)
                                                ? [view.from ? `from ${prettyDate(view.from)}` : null, view.to ? `to ${prettyDate(view.to)}` : null].filter(Boolean).join(' ')
                                                : null,
                                            bookingsStatus === 'ready'
                                                ? (bookings.length
                                                    ? [
                                                        activeBookings.length
                                                            ? `${activeBookings.length} booking${activeBookings.length === 1 ? '' : 's'} · ${guestCount} guest${guestCount === 1 ? '' : 's'}`
                                                            : 'No active bookings',
                                                        cancelledCount ? `${cancelledCount} cancelled` : null,
                                                    ].filter(Boolean).join(' · ')
                                                    : 'No bookings')
                                                : null,
                                        ].filter(Boolean).join(' · ') || ' '}
                                    </p>
                                </div>
                                <div className='bookingsTools'>
                                    {view.type === 'upcoming' ? (<>
                                        <label className='sr-only' htmlFor='upcomingDays'>How far ahead</label>
                                        <select id='upcomingDays' value={upcomingDays} onChange={(e) => setUpcomingDays(e.target.value)}>
                                            {UPCOMING_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                        </select>
                                    </>) : null}
                                    <label className='toggle'>
                                        <input type='checkbox' checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
                                        Show cancelled
                                    </label>
                                </div>
                            </div>
                            <form className='searchForm' onSubmit={search} role='search'>
                                <label className='sr-only' htmlFor='bookingSearch'>Search by name, email, phone or booking reference</label>
                                <input id='bookingSearch' type='search' placeholder='Name, email, phone or reference'
                                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                <label htmlFor='searchFrom'>From</label>
                                <input id='searchFrom' type='date' value={searchFrom} max={searchTo || undefined} onChange={(e) => setSearchFrom(e.target.value)} />
                                <label htmlFor='searchTo'>to</label>
                                <input id='searchTo' type='date' value={searchTo} min={searchFrom || undefined} onChange={(e) => setSearchTo(e.target.value)} />
                                <button type='submit' className='btn btnSmall'>Search</button>
                                {searching ? <button type='button' className='btn btnSmall btnGhost' onClick={clearSearch}>Back to day</button> : null}
                            </form>

                            {/* Searching by an email address: everything held for it, to download or erase (spec P2-13) */}
                            {searching && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(view.term) ? (
                                <CustomerData key={view.term} email={view.term.toLowerCase()} onResult={showNotice} onErased={refreshBookings} />
                            ) : null}

                            {dayView && movedTrips.length ? (
                                <p className='tripMoved' role='note'>
                                    {movedTrips.map((trip) => `The ${trip.extra ? trip.name : `${trip.timeslot} trip`} leaves at ${trip.time} from the ${trip.harbour} today`).join('. ')}.
                                </p>
                            ) : null}

                            {bookingsStatus === 'loading' ? <p className='muted' aria-busy='true'>Loading bookings…</p> : null}
                            {bookingsStatus === 'error' ? <p className='seasonError' role='alert'>{bookingsError || 'Could not load bookings. Try again in a moment.'}</p> : null}
                            {bookingsStatus === 'ready' && bookings.length && dayView ? (
                                <BookingsTable bookings={bookings} trips={trips}
                                    onEdit={setEditing} onCancel={cancelBooking}
                                    onRestore={restoreBooking} onDeletePermanently={deletePermanently}
                                    onMarkPaid={markPaid} onMarkUnpaid={markUnpaid} />
                            ) : null}
                            {bookingsStatus === 'ready' && bookings.length && !dayView ? (
                                <BookingsByDay bookings={bookings} onOpenDay={openDay} />
                            ) : null}
                            {bookingsStatus === 'ready' && !bookings.length ? (
                                <p className='emptyState'>
                                    {view.type === 'upcoming' ? `No bookings in the ${UPCOMING_CHOICES.find(([value]) => value === upcomingDays)[1].toLowerCase().replace('all upcoming', 'future')}.`
                                        : searching ? 'No bookings found. Try part of a name, an email, a phone number or a reference.'
                                            : 'Nothing booked for this day yet.'}
                                </p>
                            ) : null}

                            {dayView && notes.length ? (
                                <div className='dayNote'>
                                    <strong>Notes</strong>
                                    <button type='button' className='btnLink' onClick={() => changeTab('notes')}>Manage</button>
                                    {notes.map((note) => <p key={note._id}>{note.content}</p>)}
                                </div>
                            ) : null}

                        </>) : null}

                        {/* Moving, messaging and cancelling a whole trip: on their own tab, to keep the bookings list clear */}
                        {tab === 'tools' ? (<>
                            <div className='panelHead'>
                                <div>
                                    <h2>{prettyDate(selectedDate)}</h2>
                                    <p className='muted'>These act on the day picked on the calendar.</p>
                                </div>
                            </div>
                            {!dayView ? (
                                // bookings holds the upcoming list or search results then, not the day's bookings
                                <p className='emptyState'>
                                    Showing {searching ? 'search results' : 'upcoming bookings'}.{' '}
                                    <button type='button' className='btnLink' onClick={clearSearch}>Back to the day</button> to use the trip tools.
                                </p>
                            ) : null}
                            {dayView && bookingsStatus === 'loading' ? <p className='muted' aria-busy='true'>Loading the day…</p> : null}
                            {dayView && bookingsStatus === 'error' ? <p className='seasonError' role='alert'>Could not load the day&apos;s bookings. Try again in a moment.</p> : null}
                            {dayView && bookingsStatus === 'ready' ? (<>
                                <ChangeTripForm key={`${selectedDate}|${trips.map((trip) => trip.startTime + trip.harbourKey).join()}`}
                                    selectedDate={selectedDate} trips={trips} bookings={bookings} onResult={showNotice} onDone={refreshBookings} />
                                <MessageTripForm selectedDate={selectedDate} trips={trips} bookings={bookings} onResult={showNotice} onDone={refreshBookings} />
                                <CancelTripForm selectedDate={selectedDate} trips={trips} bookings={bookings} onResult={showNotice} onDone={refreshBookings} />
                            </>) : null}
                        </>) : null}

                        {tab === 'new' ? (
                            <BookingForm selectedDate={selectedDate} onResult={showNotice} onDone={refreshBookings} />
                        ) : null}

                        {tab === 'availability' ? (
                            <AvailabilityForm selectedDate={selectedDate} trips={trips} onResult={showNotice} onDone={refreshBookings} />
                        ) : null}

                        {tab === 'extra' ? (
                            // bookings is null in the upcoming list and search results: the day's bookings aren't loaded then
                            <AddTripForm key={`${selectedDate}|${prices?.adult}|${prices?.child}`} selectedDate={selectedDate} trips={trips}
                                bookings={dayView ? bookings : null} prices={prices} onResult={showNotice} onDone={refreshBookings} />
                        ) : null}

                        {tab === 'vouchers' ? (
                            <VouchersPanel prices={prices} onResult={showNotice} />
                        ) : null}

                        {tab === 'report' ? (
                            <ReportPanel selectedDate={selectedDate} />
                        ) : null}

                        {tab === 'notes' ? (
                            <NotesPanel selectedDate={selectedDate} notes={notes} onAdd={addNote} onDelete={deleteNote} />
                        ) : null}
                    </div>
                </main>
            </div>
            {undo ? <UndoBar key={undo.at} text='Booking cancelled' onUndo={undoCancel} onDone={() => setUndo(null)} /> : null}
        </div>
    </>)
}

export default Dashboard
