import { useState } from 'react'
import { useLocation } from 'react-router'
import '../css/bookingForm.css'
import axios from 'axios'

function BookingForm({ selectedDate }) {

    let currentLoc = useLocation()

    const checkPage = () => {
        return currentLoc.pathname === '/dashboard'
    }

    const [showResponse, setResponse] = useState(null)
    let [updating, setUpdating] = useState(false)

    const addBooking = async (e) => {
        e.preventDefault()
        let newBooking = {
            timeslot: e.target.timeslot.value,
            firstName: e.target.firstName.value,
            lastName: e.target.lastName.value,
            email: e.target.email.value,
            phone: e.target.phone.value,
            adults: e.target.adults.value,
            children: e.target.children.value,
            date: selectedDate,
            accommodation: e.target.accommodation.value,
            message: e.target.message.value
        }

        try {
            let response = await axios.post('http://localhost:4040/bookings/add', newBooking)
            setResponse(response.data.data)
        } catch (error) {
            console.log(error)
        }
        e.target.reset()
    }

    const updateBooking = async (e) => {
        e.preventDefault()

        let bookingId = e.target._id.value

        let updatedBooking = {
            timeslot: e.target.timeslot.value,
            firstName: e.target.firstName.value,
            lastName: e.target.lastName.value,
            email: e.target.email.value,
            phone: e.target.phone.value,
            adults: e.target.adults.value,
            children: e.target.children.value,
            date: e.target.date.value,
            accommodation: e.target.accommodation.value,
            message: e.target.message.value
        }

        try {
            const response = await axios.post(`http://localhost:4040/bookings/update/${bookingId}`, updatedBooking)
            console.log(response.data)
            setResponse(response.data.data)

        } catch (error) {
            console.log(error)
        }
        e.target.reset()
    }


    return (
        <section className='bookingForm'>
            {checkPage() ? <button onClick={() => setUpdating(!updating)}>Update/add</button> : null}

            <form onSubmit={!updating ? addBooking : updateBooking}>
                <p>
                    Required fields are followed by
                    <strong><span aria-label="Required">*</span></strong>
                </p>
                <section>
                    {updating ? <div>
                        <fieldset>
                            <legend>Updating booking</legend>
                            <p>
                                <label htmlFor="_id">
                                    <span>Enter booking _id</span>
                                </label>
                                <input type="text" id="_id" name="booking _id"
                                    placeholder="booking_id" />
                            </p>
                            <p>
                                <label htmlFor="New date">
                                    <span>New date for Booking</span>
                                </label>
                                <input type="text" id="date" name="updatedate"
                                    placeholder="yyyy-mm-dd" />
                            </p>
                        </fieldset>
                    </div> : null}
                    <fieldset>
                        <legend>Contact Information</legend>
                        <p>
                            <span style={{ backgroundColor: 'lightgreen' }}>{`You are booking for ${selectedDate}`}</span>
                        </p>
                        <p>
                            <label htmlFor="timeslot">
                                <span>Preferred time</span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <select id="timeslot" name="timeslot" required={!checkPage()}>
                                <option value="11am">11am</option>
                                <option value="2pm">2pm</option>
                            </select>
                        </p>

                        <p>
                            <label htmlFor="firstName">
                                <span>First Name</span>
                                <strong><span aria-label="Required">*</span></strong>
                            </label>
                            <input type="text" id="firstName" name="firstName" placeholder="John" required={!checkPage()} />

                        </p>
                        <p>
                            <label htmlFor="lastName">
                                <span>Last Name</span>
                                <strong><span aria-label="Required">*</span></strong>
                            </label>
                            <input type="text" id="lastName" name="lastName" placeholder="Smith" required={!checkPage()} />

                        </p>
                        <p>
                            <label htmlFor="email">
                                <span>Email: </span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="email" id="email" name="useremail" placeholder="yourname@email.com" required={!checkPage()} autoComplete='true' />

                        </p>
                        <p>
                            <label htmlFor="phone">
                                <span>Phone number: </span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="tel" id="phone" name="userphone" placeholder="(Include country code)"
                                required={!checkPage()} autoComplete='true' />

                        </p>
                        <p>
                            <label htmlFor="accommodation">
                                <span>Name of accommodation</span>
                            </label>
                            <input type="text" id="accommodation" name="useraccom"
                                placeholder="Where are you staying on Sark?" />
                        </p>
                    </fieldset>
                </section>

                <section>
                    <fieldset>
                        <legend>Booking Information</legend>
                        <p>
                            <label htmlFor="adults">
                                <span>Number of adults</span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="number" min="1" max="12" id="adults" name="adults" placeholder="max 12"
                                required={!checkPage()} />

                        </p>
                        <p>
                            <label htmlFor="children">
                                <span>Number of children</span>
                            </label>
                            <input type="number" min="0" max="12" id="children" name="children" placeholder="including infants"
                                required={!checkPage()} />

                        </p>

                        <p>
                            <label htmlFor="message">
                            </label>
                            <textarea id='message' name='message' cols="40" rows="4" placeholder={'Any further info'} />
                        </p>


                    </fieldset>
                </section>
                <div>
                    <button type="submit">Submit</button>
                    <button type="reset">Reset form</button>

                </div>



            </form>
            {showResponse != null ?
                <div className='responseDisplay'><h3>{showResponse}</h3><button onClick={() => setResponse(null)}>Confirm</button></div>
                : null}
        </section>
    )
}

export default BookingForm