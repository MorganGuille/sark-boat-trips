import { useState } from 'react'
import MyCalendar from '../components/myCalendar'
import BookingForm from '../components/bookingForm'
import axios from 'axios'

import '../css/dashboard.css'


function Dashboard() {

    const [loggedin, setLoggedIn] = useState(false)
    const [selectedDate, setSelectedDate] = useState()
    const [bookings, setBookings] = useState([])
    const [search, setSearch] = useState("")
    const [deleted, setDeleted] = useState("")



    // log in / out logic below

    const checkLogin = async (e) => {
        e.preventDefault()
        let user = {
            userName: e.target.username.value,
            password: e.target.password.value
        }
        let response = await axios.post('http://localhost:4040/admin/login', user)
        setLoggedIn(response.data.data)
    }

    const Logout = async () => {
        setLoggedIn(false)
    }

    // log in / out logic above

    const getBookingsByDate = async () => {
        console.log(selectedDate)
        try {
            const res = await axios.get(`http://localhost:4040/bookings/${selectedDate}`);
            setBookings(res.data.data)
            console.log(res.data.data)
        } catch (error) {
            console.error(error);
        }
    }

    const getBookingsByLastName = async (e) => {
        e.preventDefault()
        setSearch(e.target.lastName.value)
        try {
            const res = await axios.get(`http://localhost:4040/bookings/search/${search}`);
            setBookings(res.data.data)

        } catch (error) {
            console.error(error);
        }
    }

    const deleteBooking = async (e) => {
        e.preventDefault()
        let booking = {
            date: e.target.date.value,
            lastName: e.target.lastName.value
        }

        try {
            const res = await axios.post(`http://localhost:4040/bookings/delete`, booking)
            setDeleted(res.data.data)

        } catch (error) {
            console.log(error)
        }
    }




    return (<section className='dashboard'>
        {loggedin ? <button className='logoutButton' onClick={Logout}>Log Out</button> : null}
        <div>Admin panel</div>
        {!loggedin ? <form onSubmit={checkLogin}>
            <input type="text" id="username" name="username" placeholder="username" required />
            <input type="password" id="password" name="password" placeholder="password" required />
            <div>
                <button type="submit">Log in</button>
                <button onClick={Logout} type="reset">Log Out</button>
            </div>
        </form> : null}
        {loggedin ? <p className='logged'>logged in</p> : <p className='notLogged'>Please log in</p>}

        {loggedin ? <div className='bookingsDisplay' >
            <MyCalendar setSelectedDate={setSelectedDate} />
            <div className='bookingsTable'>


                <button onClick={getBookingsByDate}>Get bookings by date</button>
                <form id='bookingsearch' onSubmit={getBookingsByLastName}>
                    <input type='text' id="lastName" name="lastName" placeholder='get bookings by last name' />
                </form>

                {bookings.length != 0 ? <table>
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
                                </tr>
                            </>
                        })}
                    </tbody>
                </table > : null}

                <form id='deleteBooking' onSubmit={deleteBooking} className='deleteBooking' >
                    <input type='text' id="lastName" name="lastName" placeholder='Lastname' />
                    <input type='text' id="date" name="date" placeholder='Date yyyy-mm-dd' />
                    <button style={{ backgroundColor: 'lightcoral' }}>Delete this booking</button>
                    {deleted ? <div>{deleted}</div> : null}
                </form>

                <BookingForm selectedDate={selectedDate} />
            </div>
        </div> : null
        }

    </section >
    )
}

export default Dashboard

// firstName: e.target.firstName.value,
// lastName: e.target.lastName.value,
// email: e.target.email.value,
// adults: e.target.adults.value,
// children: e.target.children.value,
// date: selectedDate,
// accommodation: e.target.accommodation.value,
// message: e.target.message.value

