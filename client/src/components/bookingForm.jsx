import { useState } from 'react'
import { useLocation } from 'react-router'
import '../css/bookingForm.css'
import axios from 'axios'
import { URL } from '../../config.js'
import { authAxios } from '../services.jsx/auth.jsx'
import { showDay } from '../utils/dates.js'


// booking / onResult / onDone are only passed by the dashboard: booking switches the form
// to editing that booking, onResult shows messages there instead of the popup
function BookingForm({ selectedDate, booking, onResult, onDone }) {

    let currentLoc = useLocation()

    const checkPageDashboard = () => {
        return currentLoc.pathname === '/dashboard'
    }

    const checkPageCharters = () => {
        return currentLoc.pathname === '/charters'
    }

    const [showResponse, setResponse] = useState(null)
    const updating = Boolean(booking)
    // Clients must fill everything in; on the dashboard any detail may be missing
    const fieldsRequired = !checkPageDashboard()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const showResult = (message, type = 'success') => onResult ? onResult(message, type) : setResponse(message)


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
            infants: e.target.infants.value,
            date: selectedDate,
            accommodation: e.target.accommodation.value,
            message: e.target.message.value,
            website_url: e.target.website_url?.value,
            charter: 'false'
        }

        try {
            if (!checkPageDashboard()) {
                // Customers save a card on Stripe's page; the booking is made once it is saved
                const response = await axios.post(`${URL}/bookings/checkout`, newBooking)
                if (response.data.url) {
                    window.location.href = response.data.url
                    return
                }
                showResult(response.data.data, 'error')
                return
            }
            let response = await authAxios.post(`${URL}/bookings/admin-add`, newBooking)
            const failed = response.data.ok === false
            showResult(response.data.data, failed ? 'error' : 'success')
            if (!failed) {
                e.target.reset()
                onDone?.()
            }
        } catch (error) {
            console.log(error)
            showResult(error.response?.data?.data || 'Sorry, we could not make your booking. Nothing has been charged. Please try again, or contact us to book.', 'error')
        } finally {
            setIsSubmitting(false)
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
            infants: e.target.infants.value,
            date: selectedDate,
            accommodation: e.target.accommodation.value,
            message: e.target.message.value,
            website_url: e.target.website_url?.value,
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
            showResult(error.response?.data?.data || "Sorry, something went wrong starting your payment. You have not been charged. Please try again, or contact us to book.", 'error');
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
            infants: e.target.infants.value,
            date: e.target.date.value,
            accommodation: e.target.accommodation.value,
            message: e.target.message.value,
            charter: e.target.charter.value,
            notifyCustomer: e.target.notifyCustomer.checked
        }

        try {
            const response = await authAxios.post(`${URL}/bookings/update/${bookingId}`, updatedBooking)
            console.log(response.data)
            showResult(response.data.data, response.data.ok === false ? 'error' : 'success')
            if (response.data.ok !== false) onDone?.()

        } catch (error) {
            console.log(error)
            showResult(error.response?.data?.data || 'Could not update booking', 'error')
        } finally {
            setIsSubmitting(false)
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
                <form
                    className='bookingForm'
                    onSubmit={(e) => actionOnClick(e)}
                    aria-label={updating ? "Update existing booking" : "Request a new booking"}
                >
                    <div>
                        <span>Required fields are followed by <strong><span aria-hidden="true">*</span></strong></span>
                    </div>

                    {updating ? (
                        <fieldset className='updateSettings'>
                            <legend>Update Settings</legend>
                            <div>
                                <label htmlFor="_id">Booking ID <strong>*</strong></label>
                                <input type="text" id="_id" name="_id" required readOnly defaultValue={booking?._id} />
                            </div>
                            <div>
                                <label htmlFor="date">New Date</label>
                                <input type="date" id="date" name="date" defaultValue={booking?.date} />
                            </div>
                            <div>
                                <label htmlFor="charter">Status</label>
                                <select id="charter" name="charter" defaultValue={booking?.charter === 'true' ? 'true' : 'false'}>
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
                                {updating
                                    ? `Editing the booking for ${booking.firstName} ${booking.lastName}`
                                    : `You are booking ${checkPageCharters() ? 'a private charter' : 'a tour'} for ${showDay(selectedDate)}`}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="timeslot">
                                Preferred time <strong>*</strong>
                            </label>
                            <select id="timeslot" name="timeslot" defaultValue={booking?.timeslot ?? '11am'} required={fieldsRequired}>
                                <option value="11am">11am</option>
                                <option value="2pm">2pm</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="firstName">First Name <strong>*</strong></label>
                            <input type="text" id="firstName" name="firstName" defaultValue={booking?.firstName} placeholder="John" required={fieldsRequired} autoComplete="given-name" />
                        </div>

                        <div>
                            <label htmlFor="lastName">Last Name <strong>*</strong></label>
                            <input type="text" id="lastName" name="lastName" defaultValue={booking?.lastName} placeholder="Smith" required={fieldsRequired} autoComplete="family-name" />
                        </div>

                        <div>
                            <label htmlFor="email">Email <strong>*</strong></label>
                            <input type="email" id="email" name="email" defaultValue={booking?.email} placeholder="yourname@email.com" required={fieldsRequired} autoComplete="email" />
                        </div>

                        <div>
                            <label htmlFor="phone">Phone number <strong>*</strong></label>
                            <input type="tel" id="phone" name="phone" defaultValue={booking?.phone} placeholder="(Include country code)" required={fieldsRequired} autoComplete="tel" />
                        </div>

                        <div>
                            <label htmlFor="accommodation">Accommodation</label>
                            <input type="text" id="accommodation" name="accommodation" defaultValue={booking?.accommodation} placeholder="Where are you staying on Sark?" />
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend>Party Details</legend>
                        <div>
                            <label htmlFor="adults">Adults (15 and over) <strong>*</strong></label>
                            <input type="number" min="1" max="12" id="adults" name="adults" defaultValue={booking?.adults || ''} placeholder="max 12" required={fieldsRequired} />
                        </div>

                        <div>
                            <label htmlFor="children">Children (4 to 14)</label>
                            <input type="number" min="0" max="12" id="children" name="children" defaultValue={booking?.children} placeholder="0" />
                        </div>

                        <div>
                            <label htmlFor="infants">Infants (3 and under, free)</label>
                            <input type="number" min="0" max="12" id="infants" name="infants" defaultValue={booking?.infants} placeholder="0" />
                        </div>

                        <div>
                            <label htmlFor="message">Any further info / Special requirements</label>
                            <textarea id='message' name='message' cols="40" rows="4" placeholder={'e.g. mobility needs'} defaultValue={booking?.message} />
                        </div>
                    </fieldset>

                    {updating && (
                        <div className='notifyRow'>
                            <label>
                                <input type="checkbox" name="notifyCustomer" defaultChecked />
                                Email the customer about this change{booking.email ? '' : ' (there is no email address on file)'}
                            </label>
                        </div>
                    )}

                    {!checkPageDashboard() && (
                        // Hidden from people (off-screen, skipped by Tab and screen readers); bots tend to fill it in
                        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                            <label htmlFor="website_url">Leave this field empty</label>
                            <input type="text" id="website_url" name="website_url" tabIndex={-1} autoComplete="off" />
                        </div>
                    )}

                    {!checkPageDashboard() && (
                        <p className='cardNotice'>
                            Next you&apos;ll save a card on Stripe&apos;s secure page. <strong>Nothing is charged now:</strong> the
                            price is charged when your {checkPageCharters() ? 'charter' : 'trip'} starts. If we cancel because of the
                            weather, you won&apos;t be charged.
                        </p>
                    )}

                    <button className='btn' type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <span className="submitter" aria-label="Submitting..."></span> : updating ? 'Save changes' : checkPageDashboard() ? 'Confirm Booking' : 'Continue to card details'}
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