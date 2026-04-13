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

    return (
        <>
            <section aria-label="Booking Form Section">
                {checkPageDashboard() && (
                    <button
                        className='btn'
                        onClick={() => setUpdating(!updating)}
                    >
                        {updating ? 'Switch to Add New' : 'Switch to Update Existing'}
                    </button>
                )}

                <form
                    className='bookingForm'
                    onSubmit={(e) => actionOnClick(e)}
                    aria-label={updating ? "Update existing booking" : "Request a new booking"}
                >
                    <div>
                        <span>Required fields are followed by <strong><span aria-hidden="true">*</span></strong></span>
                    </div>

                    {updating ? (
                        <fieldset>
                            <legend>Update Settings</legend>
                            <div>
                                <label htmlFor="_id">Booking ID <strong>*</strong></label>
                                <input type="text" id="_id" name="_id" required placeholder="Paste ID here" />
                            </div>
                            <div>
                                <label htmlFor="date">New Date</label>
                                <input type="text" id="date" name="date" placeholder="dd-mm-yyyy" />
                            </div>
                            <div>
                                <label htmlFor="charter">Status</label>
                                <select id="charter" name="charter">
                                    <option value="false">Standard Tour</option>
                                    <option value="true">Charter Trip</option>
                                </select>
                            </div>
                        </fieldset>
                    ) : null}

                    <fieldset>
                        <legend>Contact Information</legend>
                        <div role="status" aria-live="polite">
                            <p style={{ backgroundColor: 'lightgreen', padding: '5px' }}>
                                {`You are booking ${checkPageCharters() ? 'a private charter' : 'a tour'} for ${selectedDate}`}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="timeslot">
                                Preferred time <strong>*</strong>
                            </label>
                            <select id="timeslot" name="timeslot" defaultValue="11am" required={!checkPageDashboard()}>
                                <option value="11am">11am</option>
                                <option value="2pm">2pm</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="firstName">First Name <strong>*</strong></label>
                            <input type="text" id="firstName" name="firstName" placeholder="John" required={!checkPageDashboard()} autoComplete="given-name" />
                        </div>

                        <div>
                            <label htmlFor="lastName">Last Name <strong>*</strong></label>
                            <input type="text" id="lastName" name="lastName" placeholder="Smith" required={!checkPageDashboard()} autoComplete="family-name" />
                        </div>

                        <div>
                            <label htmlFor="email">Email <strong>*</strong></label>
                            <input type="email" id="email" name="email" placeholder="yourname@email.com" required={!checkPageDashboard()} autoComplete="email" />
                        </div>

                        <div>
                            <label htmlFor="phone">Phone number <strong>*</strong></label>
                            <input type="tel" id="phone" name="phone" placeholder="(Include country code)" required={!checkPageDashboard()} autoComplete="tel" />
                        </div>

                        <div>
                            <label htmlFor="accommodation">Accommodation</label>
                            <input type="text" id="accommodation" name="accommodation" placeholder="Where are you staying on Sark?" />
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend>Party Details</legend>
                        <div>
                            <label htmlFor="adults">Number of adults <strong>*</strong></label>
                            <input type="number" min="1" max="12" id="adults" name="adults" placeholder="max 12" required={!checkPageDashboard()} />
                        </div>

                        <div>
                            <label htmlFor="children">Number of children (14yrs and under)</label>
                            <input type="number" min="0" max="12" id="children" name="children" placeholder="including infants" />
                        </div>

                        <div>
                            <label htmlFor="message">Any further info / Special requirements</label>
                            <textarea id='message' name='message' cols="40" rows="4" placeholder={'e.g. mobility needs'} />
                        </div>
                    </fieldset>

                    <button className='btn' type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <span className="submitter" aria-label="Submitting..."></span> : 'Confirm Booking'}
                    </button>
                </form>

                {showResponse != null && (
                    <div className="responseBackdrop" role="dialog" aria-labelledby="response-message" aria-modal="true">
                        <div className='responseDisplay'>
                            <h3 id="response-message">{showResponse}</h3>
                            <button className='btn' onClick={() => setResponse(null)} autoFocus>
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </>
    )
}

export default BookingForm