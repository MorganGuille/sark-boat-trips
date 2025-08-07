import { useState } from 'react'
import { useLocation } from 'react-router'
import '../css/bookingForm.css'
import axios from 'axios'
import { URL } from '../../config.js'


function BookingForm({ selectedDate }) {

    let currentLoc = useLocation()

    const checkPageDashboard = () => {
        return currentLoc.pathname === '/dashboard'
    }

    const checkPageCharters = () => {
        return currentLoc.pathname === '/charters'
    }

    const [showResponse, setResponse] = useState(null)
    const [updating, setUpdating] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)


    const addBooking = async (e) => {
        e.preventDefault()
        setIsSubmitting(true);
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
            message: e.target.message.value,
            charter: 'false'
        }

        try {
            let response = await axios.post(`${URL}/bookings/add`, newBooking)
            setResponse(response.data.data)
        } catch (error) {
            console.log(error)
        } finally {
            setIsSubmitting(false)
            e.target.reset()
        }
    }

    const addCharterBooking = async (e) => {
        e.preventDefault();

        setIsSubmitting(true);
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
            message: e.target.message.value,
            charter: 'true'
        }


        try {
            const response = await axios.post(`${URL}/charters/create-checkout-session`, newBooking);
            if (response.data.url) {

                window.location.href = response.data.url;
            } else {
                setResponse(response.data.data)
                console.log(response.data.data);
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateBooking = async (e) => {
        e.preventDefault()
        setIsSubmitting(true);
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
            message: e.target.message.value,
            charter: e.target.charter.value
        }

        try {
            const response = await axios.post(`${URL}/bookings/update/${bookingId}`, updatedBooking)
            console.log(response.data)
            setResponse(response.data.data)

        } catch (error) {
            console.log(error)
        } finally {
            setIsSubmitting(false)
            e.target.reset()
        }

    }

    const actionOnClick = (e) => {
        if (!updating && !checkPageCharters()) {
            return addBooking(e);
        } else if (updating && checkPageDashboard()) {
            return updateBooking(e);
        } else if (checkPageCharters()) {
            return addCharterBooking(e);
        } else {
            e.preventDefault();
            console.log('Error');
            ;
        }
    }

    return (<>

        <section >
            {checkPageDashboard() ? <button className='btn' onClick={() => setUpdating(!updating)}>Update/add</button> : null}

            <form className='bookingForm' onSubmit={(e) => actionOnClick(e)}>
                <div>
                    <span>Required fields are followed by<strong><span aria-label="Required">*</span></strong></span>
                </div>

                {updating ? <>
                    <fieldset>
                        <legend>Updating booking</legend>
                        <div>
                            <label htmlFor="_id">
                                <span>Enter booking _id</span>
                            </label>
                            <input type="text" id="_id" name="booking _id"
                                placeholder="booking_id" />
                        </div>
                        <div>
                            <label htmlFor="New date">
                                <span>New date for Booking</span>
                            </label>
                            <input type="text" id="date" name="updatedate"
                                placeholder="dd-mm-yyyy" />
                        </div>
                        <div>
                            <label htmlFor="charter">
                                <span>Charter</span>
                            </label>
                            <select id="charter" name="charter" >
                                <option value="false">Not Charter</option>
                                <option value="true">Charter Trip</option>
                            </select>
                        </div>
                    </fieldset>
                </> : null}
                <fieldset>
                    <legend>Contact Information</legend>
                    <div>
                        <span style={{ backgroundColor: 'lightgreen' }}>{`You are booking ${checkPageCharters() ? 'a private charter' : ''} for ${selectedDate}`}</span>
                    </div>
                    <div>
                        <label htmlFor="timeslot">
                            <span>Preferred time</span>
                            <strong><span aria-label="required">*</span></strong>
                        </label>
                        <select id="timeslot" name="timeslot" defaultValue="11am" required={!checkPageDashboard()}>
                            <option value="11am">11am</option>
                            <option value="2pm">2pm</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="firstName">
                            <span>First Name</span>
                            <strong><span aria-label="Required">*</span></strong>
                        </label>
                        <input type="text" id="firstName" name="firstName" placeholder="John" required={!checkPageDashboard()} />

                    </div>
                    <div>
                        <label htmlFor="lastName">
                            <span>Last Name</span>
                            <strong><span aria-label="Required">*</span></strong>
                        </label>
                        <input type="text" id="lastName" name="lastName" placeholder="Smith" required={!checkPageDashboard()} />

                    </div>
                    <div>
                        <label htmlFor="email">
                            <span>Email: </span>
                            <strong><span aria-label="required">*</span></strong>
                        </label>
                        <input type="email" id="email" name="useremail" placeholder="yourname@email.com" required={!checkPageDashboard()} autoComplete='true' />

                    </div>
                    <div>
                        <label htmlFor="phone">
                            <span>Phone number: </span>
                            <strong><span aria-label="required">*</span></strong>
                        </label>
                        <input type="tel" id="phone" name="userphone" placeholder="(Include country code)"
                            required={!checkPageDashboard()} autoComplete='true' />

                    </div>
                    <div>
                        <label htmlFor="accommodation">
                            <span>Name of accommodation</span>
                        </label>
                        <input type="text" id="accommodation" name="useraccom"
                            placeholder="Where are you staying on Sark?" />
                    </div>
                </fieldset>



                <fieldset>
                    <legend>Booking Information</legend>
                    <div>
                        <label htmlFor="adults">
                            <span>Number of adults</span>
                            <strong><span aria-label="required">*</span></strong>
                        </label>
                        <input type="number" min="1" max="12" id="adults" name="adults" placeholder="max 12"
                            required={!checkPageDashboard()} />

                    </div>
                    <div>
                        <label htmlFor="children">
                            <span>Number of children (14yrs and under)</span>
                        </label>
                        <input type="number" min="0" max="12" id="children" name="children" placeholder="including infants" />
                    </div>

                    <div>
                        <label htmlFor="message">
                        </label>
                        <textarea id='message' name='message' cols="40" rows="4" placeholder={'Any further info'} />
                    </div>


                </fieldset>


                <button className='btn' type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <span className="submitter"></span> : 'Book now!'}
                </button>
            </form>
            {showResponse != null ?
                <div className="responseBackdrop">
                    <div className='responseDisplay'><h3>{showResponse}</h3><button className='btn' onClick={() => setResponse(null)}>Confirm</button></div>
                </div>
                : null}
        </section>
    </>)
}

export default BookingForm