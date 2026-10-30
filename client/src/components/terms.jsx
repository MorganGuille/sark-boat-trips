import { FREE_CANCEL_HOURS } from '../utils/policy.js'

// Shown in the footer pop-up and on its own page at /terms (the page Stripe links to)
function Terms({ className = 'popUpDisplay' }) {
    return (
        <article className={className} aria-labelledby="terms-title">
            <h2 id="terms-title">Terms and Conditions - Sark Boat Trips</h2>

            <section>
                <p><strong>1. Booking and payment</strong></p>
                <p>When you book online you save a card on Stripe&apos;s secure page. <strong>Nothing is charged when you book.</strong> The full price of your booking is charged to that card when your trip starts, and Stripe emails you a receipt. The charge shows on your statement as Sark Boat Trips.</p>
                <p>Our prices are shown on the booking page. Adults are 15 and over, children are 4 to 14, and infants (3 and under) go free. Everyone needs a seat, infants included, so please include them in your booking.</p>
                <p>Your card details are handled by Stripe: we never see or keep your full card number (see our <a href='/privacy'>privacy policy</a>). If the charge doesn&apos;t go through, we&apos;ll ask you to pay on the day by cash or card. Bookings made directly with us (by phone, email or in person) are paid on the day, by cash or card (GBP).</p>
            </section>

            <section>
                <p><strong>2. Cancellation by you</strong></p>
                <p>Trips: cancel at least <strong>{FREE_CANCEL_HOURS.trip} hours</strong> before your trip starts and you won&apos;t be charged. Private charters: cancel at least <strong>{FREE_CANCEL_HOURS.charter} hours</strong> before. If you cancel later than that, or don&apos;t come, the full price is charged.</p>
                <p>If fewer people come than you booked, you&apos;re charged for the booking as it was made, unless you told us about the change before the same deadline.</p>
                <p>To cancel or change a booking, call or WhatsApp us on +44 7911 764 246, or email sarkboattrips@gmail.com.</p>
            </section>

            <section>
                <p><strong>3. Cancellation or changes by Sark Boat Trips</strong></p>
                <p>We may cancel or reschedule a trip because of the weather or sea conditions, a mechanical problem, or if fewer than 4 passengers are booked on a scheduled trip. <strong>If we cancel, you won&apos;t be charged</strong>, and if you have already been charged we will refund you in full. We&apos;ll offer you another trip where we can. We are not liable for any consequential losses (for example travel or accommodation costs).</p>
                <p>If we need to change the time of your trip we&apos;ll contact you. Your card is then charged when the trip actually starts, and if the new time doesn&apos;t suit you, tell us and you won&apos;t be charged.</p>
            </section>

            <section>
                <p><strong>4. Safety & Conduct</strong></p>
                <p>Passengers must follow all instructions given by the skipper. We reserve the right to refuse passage to anyone deemed a safety risk, including those under the influence of excessive alcohol. Children must be supervised at all times. Passengers must remain seated while the vessel is underway.</p>
            </section>

            <section>
                <p><strong>5. Personal Belongings</strong></p>
                <p>Sark Boat Trips is not liable for loss or damage to personal items (cameras, phones, etc.) while on board. We recommend keeping electronics in waterproof bags.</p>
            </section>

            <section>
                <p><strong>6. Liability</strong></p>
                <p>Sark Boat Trips maintains full public liability insurance as required by Guernsey law. Our liability begins once you are on board the vessel and ends upon disembarkation.</p>
            </section>

            <section>
                <p><strong>7. Medical Conditions</strong></p>
                <p>Please inform the skipper of any medical conditions, limited mobility, or severe sea sickness before departure so we can ensure your safety and comfort.</p>
            </section>

            <section>
                <p><strong>8. Governing Law</strong></p>
                <p>These terms are governed by and construed in accordance with the laws of the Bailiwick of Guernsey.</p>
            </section>

            <section>
                <p><strong>9. Wildlife</strong></p>
                <p>While we know the best spots for puffins, seals, and dolphins, sightings are subject to nature and cannot be guaranteed.</p>
            </section>
        </article>
    )
}

export default Terms
