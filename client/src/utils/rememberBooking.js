// What a customer typed into the booking form, kept for this browser tab (sessionStorage), so it is still
// there after an error or when they come back from Stripe's page without saving a card. It is gone when
// the tab is closed, and the success page forgets it. Storage can be refused (private browsing), so every
// call is wrapped: the form still works, it just won't remember.
const SAVED = 'sbt-booking-details'

export const remembered = () => {
    try {
        return JSON.parse(window.sessionStorage.getItem(SAVED)) || {}
    } catch {
        return {}
    }
}

export const remember = (details) => {
    try {
        window.sessionStorage.setItem(SAVED, JSON.stringify(details))
    } catch {
        // nothing kept
    }
}

export const forgetBookingDetails = () => {
    try {
        window.sessionStorage.removeItem(SAVED)
    } catch {
        // nothing to forget
    }
}
