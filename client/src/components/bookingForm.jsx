import React from 'react'
import '../css/bookingForm.css'
import axios from 'axios'

function BookingForm({ selectedDate }) {

    const handleSubmit = async (e) => {
        e.preventDefault()
        let newBooking = {
            firstName: e.target.firstName.value,
            lastName: e.target.lastName.value,
            email: e.target.email.value,
            adults: e.target.adults.value,
            children: e.target.children.value,
            date: selectedDate,
            accommodation: e.target.accommodation.value,
            message: e.target.message.value
        }

        let response = await axios.post('http://localhost:4040/bookings/add', newBooking)
        console.log(response)
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
                            <input type="email" id="email" name="useremail" placeholder="yourname@email.com" required />
                            <span></span>
                        </p>
                        <p>
                            <label htmlFor="phone">
                                <span>Phone number: </span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="tel" id="phone" name="userphone" placeholder="(Include country code)"
                                required />
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
                            <label htmlFor="Adults">
                                <span>Number of adults</span>
                                <strong><span aria-label="required">*</span></strong>
                            </label>
                            <input type="number" min="1" max="12" id="adults" name="adults" placeholder="max 12"
                                required />
                            <span></span>
                        </p>
                        <p>
                            <label htmlFor="Children">
                                <span>Number of children</span>
                            </label>
                            <input type="number" min="1" max="12" id="children" name="children" placeholder="including infants"
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
        </section>
    )
}

export default BookingForm