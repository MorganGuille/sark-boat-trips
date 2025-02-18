import { useState } from 'react'
import '../css/bookingForm.css'
import axios from 'axios'

function BookingForm({ selectedDate }) {

    let [showResponse, setResponse] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        let newBooking = {
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
            console.log(response.data)
            setResponse(response.data.data)
        } catch (error) {
            console.log(error)
        }
    }


    return (
        <section className='bookingForm'>
            <form onSubmit={handleSubmit}>
                <p>
                    Required fields are followed by
                    <strong><span aria-label="Required">*</span></strong>
                </p>
                <section>
                    <fieldset>
                        <legend>Contact Information</legend>
                        <p>
                            <span style={{ backgroundColor: 'lightgreen' }}>{`You are booking for ${selectedDate}`}</span>
                        </p>
                        <p>
                            <label htmlFor="firstName">
                                <span>First Name</span>
                                <strong><span aria-label="Required">*</span></strong>
                            </label>
                            <input type="text" id="firstName" name="firstName" placeholder="John" required />
                            <span></span>
                        </p>
                        <p>
                            <label htmlFor="lastName">
                                <span>Last Name</span>
                                <strong><span aria-label="Required">*</span></strong>
                            </label>
                            <input type="text" id="lastName" name="lastName" placeholder="Smith" required />
                            <span></span>
                        </p>
                        <p>
                            <label htmlFor="email">
                                <span>Email: </span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="email" id="email" name="useremail" placeholder="yourname@email.com" required autoComplete='true' />
                            <span></span>
                        </p>
                        <p>
                            <label htmlFor="phone">
                                <span>Phone number: </span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="tel" id="phone" name="userphone" placeholder="(Include country code)"
                                required autoComplete='true' />
                            <span></span>
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
                                required />
                            <span></span>
                        </p>
                        <p>
                            <label htmlFor="children">
                                <span>Number of children</span>
                            </label>
                            <input type="number" min="0" max="12" id="children" name="children" placeholder="including infants"
                                required />
                            <span></span>
                        </p>
                        {/* <p>
                            <label htmlFor="time">
                                <span>Preferred time</span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <select id="time" name="triptime">
                                <option value="11am">11am</option>
                                <option value="2px">2pm</option>
                            </select>
                        </p> */}
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
                <div className='responseDisplay'>
                    <span>{showResponse}<button onClick={() => setResponse(null)}>click here</button></span>
                </div> : null}
        </section>
    )
}

export default BookingForm