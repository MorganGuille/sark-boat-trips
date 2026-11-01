import { useEffect, useState } from 'react'
import '../css/bookingForm.css'
import { URL } from '../../config.js'
import { authAxios } from '../services.jsx/auth.jsx'
import { showDay } from '../utils/dates.js'
import { getDayTrips, USUAL_TRIPS } from '../services.jsx/trips.jsx'
import { formatPounds } from '../utils/money.js'


// The dashboard's booking form: adds a booking (New booking tab), or edits one when booking is passed.
// Any detail may be missing (phone bookings). onResult shows the server's message on the dashboard,
// onDone refreshes the day. Customers use their own form (customerBookingForm.jsx).
function BookingForm({ selectedDate, booking, onResult, onDone }) {

    const updating = Boolean(booking)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const showResult = (message, type = 'success') => onResult(message, type)

    // The day's trips: the owner may have moved one to another time or harbour that day
    const tripsDate = updating ? booking?.date : selectedDate
    const [trips, setTrips] = useState(USUAL_TRIPS)
    const [timeslot, setTimeslot] = useState(booking?.timeslot ?? '11am')
    useEffect(() => {
        if (!tripsDate) return
        let current = true
        getDayTrips(tripsDate)
            .then((dayTrips) => { if (current && Array.isArray(dayTrips)) setTrips(dayTrips) })
            .catch(() => { if (current) setTrips(USUAL_TRIPS) })
        return () => { current = false }
    }, [tripsDate])
    const offered = trips
    // The chosen trip, or the first one if it isn't running on this day
    const chosenTrip = offered.find((trip) => trip.timeslot === timeslot) || offered[0]


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
            charter: 'false'
        }

        try {
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

    const actionOnClick = (e) => (updating ? updateBooking(e) : addBooking(e))

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
                                    : `You are booking a tour for ${showDay(selectedDate)}`}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="timeslot">
                                Preferred time <strong>*</strong>
                            </label>
                            <select id="timeslot" name="timeslot" value={chosenTrip?.timeslot ?? ''} onChange={(e) => setTimeslot(e.target.value)}>
                                {offered.map((trip) => (
                                    <option key={trip.timeslot} value={trip.timeslot}>
                                        {trip.time}{trip.extra ? ` ${trip.name}` : ''}{trip.timeChanged ? ` (moved from ${trip.timeslot})` : ''}
                                    </option>
                                ))}
                            </select>
                            {chosenTrip?.extra ? (
                                <p className='tripNote extraTripNote'>
                                    <strong>{chosenTrip.name}</strong>: {formatPounds(Number(chosenTrip.prices.adult))} per adult,{' '}
                                    {formatPounds(Number(chosenTrip.prices.child))} per child (infants free), about {chosenTrip.hours} hour{Number(chosenTrip.hours) === 1 ? '' : 's'}.
                                    {chosenTrip.note ? <><br />{chosenTrip.note}</> : null}
                                </p>
                            ) : null}
                            {chosenTrip?.harbourChanged ? (
                                <p className='tripNote'>On this day the {chosenTrip.extra ? chosenTrip.name : `${chosenTrip.time} trip`} leaves from the <strong>{chosenTrip.harbour}</strong>, not the Creux Harbour.</p>
                            ) : null}
                        </div>

                        <div>
                            <label htmlFor="firstName">First Name <strong>*</strong></label>
                            <input type="text" id="firstName" name="firstName" defaultValue={booking?.firstName} placeholder="John" autoComplete="given-name" />
                        </div>

                        <div>
                            <label htmlFor="lastName">Last Name <strong>*</strong></label>
                            <input type="text" id="lastName" name="lastName" defaultValue={booking?.lastName} placeholder="Smith" autoComplete="family-name" />
                        </div>

                        <div>
                            <label htmlFor="email">Email <strong>*</strong></label>
                            <input type="email" id="email" name="email" defaultValue={booking?.email} placeholder="yourname@email.com" autoComplete="email" />
                        </div>

                        <div>
                            <label htmlFor="phone">Phone number <strong>*</strong></label>
                            <input type="tel" id="phone" name="phone" defaultValue={booking?.phone} placeholder="(Include country code)" autoComplete="tel" />
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
                            <input type="number" min="1" max="12" id="adults" name="adults" defaultValue={booking?.adults || ''} placeholder="max 12" />
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

                    <button className='btn' type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <span className="submitter" aria-label="Submitting..."></span> : updating ? 'Save changes' : 'Confirm Booking'}
                    </button>
                </form>
            </section>
        </>
    )
}

export default BookingForm