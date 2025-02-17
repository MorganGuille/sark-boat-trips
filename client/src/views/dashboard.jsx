import { useState } from 'react'
import MyCalendar from '../components/myCalendar'
import axios from 'axios'

import '../css/dashboard.css'


function Dashboard() {

    const [loggedin, setLoggedIn] = useState(false)
    const [selectedDate, setSelectedDate] = useState()
    const [bookings, setBookings] = useState([])

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
        <div>
            {loggedin ? <div className='bookingsDisplay' >
                <MyCalendar setSelectedDate={setSelectedDate} />
                <div className='bookingsTable'>
                    <button onClick={getBookingsByDate}>Get bookings by date</button>
                    <table>
                        <thead>
                            <tr>
                                <th>First Name</th>
                                <th>Last Name</th>
                                <th>Email</th>
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
                                        <td>{ele.firstName}</td>
                                        <td>{ele.lastName}</td>
                                        <td>{ele.email}</td>
                                        <td>{ele.adults}</td>
                                        <td>{ele.children}</td>
                                        <td>{ele.accommodation}</td>
                                        <td className='message'>{ele.message}</td>
                                    </tr>
                                </>
                            })}
                        </tbody>
                    </table >
                </div>
            </div> : null
            }
        </div >
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


// {bookings.map((ele, i) => {
//     return <>
//         <table>
//             <tbody>
//                 <tr key={i}>
//                     <td>{ele.firstName}</td>
//                     <td>{ele.lastName}</td>
//                     <td>{ele.email}</td>
//                 </tr>
//             </tbody>
//         </table>
//     </>
// })}