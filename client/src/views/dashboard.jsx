import { useState } from 'react'
import MyCalendar from '../components/myCalendar'
import BookingForm from '../components/bookingForm'
import axios from 'axios'
import { URL } from '../../config.js'

import '../css/dashboard.css'

function Dashboard() {

    const [loggedin, setLoggedIn] = useState(false)
    const [selectedDate, setSelectedDate] = useState()
    const [bookings, setBookings] = useState([])
    const [search, setSearch] = useState("")
    const [noteContent, setNoteContent] = useState("")
    const [dateNotes, setDateNotes] = useState([])
    const [showResponse, setResponse] = useState(null)


    const checkLogin = async (e) => {
        e.preventDefault()
        let user = {
            userName: e.target.username.value,
            password: e.target.password.value
        }
        let response = await axios.post(`${URL}/admin/login`, user)
        setLoggedIn(response.data.data)
    }

    const Logout = async () => {
        setLoggedIn(false)
    }

    const getBookingsByDate = async () => {

        try {
            const res = await axios.get(`${URL}/bookings/${selectedDate}`);
            setBookings(res.data.data)

        } catch (error) {
            console.error(error);
        }
    }

    const getBookingsByLastName = async (e) => {
        e.preventDefault()
        setSearch(e.target.lastName.value)
        try {
            const res = await axios.get(`${URL}/bookings/search/${search}`);
            setBookings(res.data.data)

        } catch (error) {
            console.error(error);
        }
    }

    const deleteBooking = async (e) => {
        e.preventDefault()
        let booking = {
            _id: e.target._id.value
        }
        try {
            const res = await axios.post(`${URL}/bookings/delete`, booking)
            setResponse(res.data.data)
        }
        catch (error) {
            console.log(error)
        }
        e.target.reset()
    }

    const updateAvailability = async (e) => {
        e.preventDefault()

        let update = {
            date: e.target.date.value,
            timeslot: e.target.timeslot.value,
            capacity: e.target.capacity.value,
        }
        try {
            const res = await axios.post(`${URL}/bookings/updateavailability`, update)
            setResponse(res.data.data)
        } catch (error) {
            console.log(error)
        }
    }

    const addOrUpdateNote = async (e) => {
        e.preventDefault()
        if (!selectedDate) {
            setResponse("Please select a date on the calendar first")
        }

        let noteData = {
            date: selectedDate,
            content: noteContent
        }

        try {
            const res = await axios.post(`${URL}/notes`, noteData)
            setResponse(res.data.message || "Note saved successfully!")
            setNoteContent('')
            fetchNotesForSelectedDate();
        } catch (error) {
            setResponse(error.response?.data?.message || "Failed to save note")
        }
    }

    const fetchNotesForSelectedDate = async () => {
        if (!selectedDate) return

        try {
            const res = await axios.get(`${URL}/notes/${selectedDate}`)
            setDateNotes(res.data.data)
        } catch (error) {
            console.error("Error fetching notes", error)
            setDateNotes([])
        }
    }

    return (<>
        <title>Sark Boat Trips | Dashboard</title>
        <div className='dashboard'>
            <div className='centered-section padded'>
                {loggedin ? <button className='logoutButton' onClick={Logout}>Log Out</button> : null}
                {!loggedin ? <form onSubmit={checkLogin}>
                    <input type="text" id="username" name="username" placeholder="username" required />
                    <input type="password" id="password" name="password" placeholder="password" required />
                    <span>
                        <button className='btn' type="submit">Log in</button>
                        <button className='btn' onClick={Logout} type="reset">Log Out</button>
                    </span>
                </form> : null}
                {loggedin ? <p className='logged'>logged in</p> : <p className='notLogged'>Please log in</p>}
            </div>

            {loggedin ? <div  >

                <div className='bookingsDisplay'>
                    <div className='left-grid'>

                        <MyCalendar setSelectedDate={setSelectedDate} />

                        <div className='minorform'>
                            <button className='btn' onClick={() => { getBookingsByDate(); fetchNotesForSelectedDate() }}>Get bookings by date</button>
                            <form id='bookingsearch' onSubmit={getBookingsByLastName}>
                                <input type='text' id="lastName" name="lastName" placeholder='get bookings by last name' />
                            </form>
                        </div>

                        <form id='deleteBooking' onSubmit={deleteBooking} className='minorform' >
                            <input type='text' id='_id' name='_id' placeholder='Booking ID' />
                            <button className='btn' style={{ backgroundColor: 'lightcoral' }}>Delete this booking</button>
                        </form>

                        <form id='updateAvailability' className='minorform' onSubmit={updateAvailability}>
                            <input type='text' id="date" name="date" placeholder='Date dd-mm-yyyy' />
                            <select id="timeslot" name="timeslot" required>
                                <option value="11am">11am</option>
                                <option value="2pm">2pm</option>
                            </select>
                            <input type="number" id="capacity" name="capacity" placeholder='capacity' required></input>
                            <button className='btn' type="submit">Update Availability</button>
                        </form>

                        <form id='addNote' className='minorform' onSubmit={addOrUpdateNote}>
                            <textarea
                                id='notecontent'
                                name='notecontent'
                                placeholder='Enter note for the selected date...'
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                rows="2"
                                cols="50"
                                required>
                            </textarea>
                            <button className='btn' type='submit'>Save Note</button>
                        </form>

                        {showResponse != null ?
                            <div className="responseBackdrop">
                                <div className='responseDisplay'><h3>{showResponse}</h3><button className='btn' onClick={() => setResponse(null)}>Confirm</button></div>
                            </div>
                            : null}
                    </div>


                    <div className='right-grid'>

                        <BookingForm selectedDate={selectedDate} />
                    </div>
                </div>

                <div className='notes-section minorform'>

                    <div className='current-notes'>
                        <h4>{`Notes for ${selectedDate}`}</h4>
                        {dateNotes.length > 0 ? (
                            <ul>
                                {dateNotes.map((note) => (
                                    <li key={note._id}>
                                        {note.content}
                                    </li>
                                ))}
                            </ul>
                        ) : (<p>No notes for this date yet.</p>)}
                    </div>

                </div>

                <div className='bookingsTable'>

                    {bookings.length != 0 ?
                        <table >
                            <thead>
                                <tr>
                                    <th>_id</th>
                                    <th>Date</th>
                                    <th>Timeslot</th>
                                    <th>First Name</th>
                                    <th>Last Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Adults</th>
                                    <th>Children</th>
                                    <th>Accommodation</th>
                                    <th>Message</th>
                                    <th>Charter</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((ele, i) => {
                                    return <>
                                        <tr key={i}>
                                            <td>{ele._id}</td>
                                            <td>{ele.date}</td>
                                            <td>{ele.timeslot}</td>
                                            <td>{ele.firstName}</td>
                                            <td>{ele.lastName}</td>
                                            <td>{ele.email}</td>
                                            <td>{ele.phone}</td>
                                            <td>{ele.adults}</td>
                                            <td>{ele.children}</td>
                                            <td>{ele.accommodation}</td>
                                            <td className='message'>{ele.message}</td>
                                            <td>{ele.charter}</td>
                                        </tr>
                                    </>
                                })}
                            </tbody>
                        </table > : null}
                </div>

            </div> : null
            }
        </div>
    </>)
}

export default Dashboard