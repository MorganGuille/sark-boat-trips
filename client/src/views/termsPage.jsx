import Terms from '../components/terms'
import { FREE_CANCEL_HOURS } from '../utils/policy.js'

// The terms on their own page, so Stripe's card page can link to them (sarkboattrips.com/terms)
function TermsPage() {
    return (
        <>
            <title>Sark Boat Trips | Terms and Conditions</title>
            <meta name="description" content={`Sark Boat Trips' terms and conditions: booking, paying when your trip starts, free cancellation up to ${FREE_CANCEL_HOURS.trip} hours before (${FREE_CANCEL_HOURS.charter} for a private charter), and what happens if the weather cancels a trip.`} />
            <main id="main-content" className='termsPage'>
                <Terms className='termsArticle' />
            </main>
        </>
    )
}

export default TermsPage
