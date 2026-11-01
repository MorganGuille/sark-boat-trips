import { FREE_CANCEL_HOURS } from '../utils/policy.js'
import { CONTACT_EMAIL, CONTACT_PHONE, PHONE_LINK } from '../utils/contact.js'
import { formatPounds } from '../utils/money.js'
import usePrices from '../hooks/usePrices'
import Bookings from '../components/bookings'

import '../css/charters.css'

import charterDerrible from '../assets/images/Charter+Tour+Derrible.webp'
import guillemots from '../assets/images/Guillemots.webp'
import beachCave from '../assets/images/gallery3.webp'
import coastline from '../assets/images/gallery10.webp'
import swimmerEscort from '../assets/images/gallery5.webp'

// The owner's charter ideas (1 Nov 2026). The evening card borrows a coastline photo until there is an evening one.
const IDEAS = [
    { title: 'Beach explorer', image: beachCave, alt: 'A secluded bay with a sea cave', text: "Sark's secluded beaches are hard to reach on foot. We'll take you there in comfort, even to bays you can't reach by land." },
    { title: 'Birdwatching', image: guillemots, alt: 'Guests watching guillemots from the boat', text: 'In season: guillemots, razorbills, puffins and fulmars. Get up close to their offshore colonies.' },
    { title: 'Evening or early morning cruise', image: coastline, alt: "Sark's coastline", text: 'Round the island in the low light. Maybe with a glass of champagne to toast the day.' },
    { title: 'Safety boat', image: swimmerEscort, alt: 'A swimmer beside the boat in a narrow gully', text: "Swimming or kayaking round the island? We'll stay close, and help you plan a safe route with the tides." },
]

// The charters page (owner's choices, 1 Nov 2026): a photo with the title and Check dates, the key facts
// (the price is the one set on the dashboard), the ideas as cards, what's good to know, then the booking form.
function Charters() {
    const { prices } = usePrices()
    const charterPrice = prices?.charter ? formatPounds(prices.charter) : null

    return (<>
        <title>Sark Boat Trips | Charters</title>
        <meta name="description" content="Private boat charters around Sark for up to 12 people: secluded bays, seabird colonies, evening cruises and safety boat cover, with paddleboards and snorkelling gear included." />
        <main id="main-content" className='chartersPage'>
            <header className='charterHero' style={{ backgroundImage: `url(${charterDerrible})` }}>
                <div className='charterHeroText'>
                    <h1>Private charters</h1>
                    <p>The boat and a local skipper to yourselves, for up to 12 people.</p>
                    <a href='#book' className='goldButton'>Check dates</a>
                </div>
            </header>

            <dl className='charterFacts'>
                <div><dt>{charterPrice || 'The whole boat'}</dt><dd>{charterPrice ? 'for the whole boat' : 'just for your group'}</dd></div>
                <div><dt>Up to 12</dt><dd>people</dd></div>
                <div><dt>About 3 hours</dt><dd>but we&apos;re flexible</dd></div>
                <div><dt>Free cancellation</dt><dd>up to {FREE_CANCEL_HOURS.charter} hours before</dd></div>
            </dl>

            <div className='charterBody'>
                <section aria-labelledby='ideas-title'>
                    <h2 id='ideas-title'>Ideas for your charter</h2>
                    <p className='charterSub'>A few favourites. Tell us what you&apos;d like and we&apos;ll plan it with you.</p>
                    <div className='ideaCards'>
                        {IDEAS.map((idea) => (
                            <article className='ideaCard' key={idea.title}>
                                <img src={idea.image} alt={idea.alt} loading='lazy' width='640' height='427' />
                                <div>
                                    <h3>{idea.title}</h3>
                                    <p>{idea.text}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <div className='goodToKnow'>
                    <section aria-labelledby='good-title'>
                        <h2 id='good-title'>Good to know</h2>
                        <ul>
                            <li>Paddleboards and snorkelling gear are included</li>
                            <li>A packed lunch can be arranged for an extra charge: just ask</li>
                            <li>Book 11am or 2pm online, or ask us for another time</li>
                        </ul>
                    </section>
                    <section aria-labelledby='paying-title'>
                        <h2 id='paying-title'>Booking and paying</h2>
                        <ul>
                            <li>You save a card to book: nothing is charged now</li>
                            <li>The price is charged when your charter starts</li>
                            <li>Free cancellation up to {FREE_CANCEL_HOURS.charter} hours before, and no charge if we cancel because of the weather</li>
                        </ul>
                    </section>
                </div>

                <div className='charterContact'>
                    <p>Have an idea of your own? Call or WhatsApp <a href={PHONE_LINK}>{CONTACT_PHONE}</a></p>
                    <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                </div>
            </div>

            <div id='book' className='charterBook'>
                <Bookings />
            </div>
        </main>
    </>)
}

export default Charters
