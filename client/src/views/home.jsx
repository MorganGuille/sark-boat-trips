import Slideshow from '../components/slideshow'
import Reviews from '../components/reviews'
import Bookings from '../components/bookings'

import { Link } from 'react-router'
import usePrices from '../hooks/usePrices'
import { formatPounds } from '../utils/money.js'

import gallery1 from '../assets/images/gallery1.webp'
import gallery2 from '../assets/images/gallery2.webp'
import gallery3 from '../assets/images/gallery3.webp'
import gallery4 from '../assets/images/gallery4.webp'
import gallery5 from '../assets/images/gallery5.webp'
import gallery6 from '../assets/images/gallery6.webp'
import gallery7 from '../assets/images/gallery7.webp'
import gallery8 from '../assets/images/gallery8.webp'
import gallery9 from '../assets/images/gallery9.webp'
import gallery10 from '../assets/images/gallery10.webp'
import gallery11 from '../assets/images/gallery11.webp'

import charters from "../assets/images/charter-swim.webp"
import cave from "../assets/images/charters.webp"
import suesbnb from "../assets/images/SuesbnbextGeorge.webp"
import dorado from "../assets/images/dorado.webp"
import guillemots from "../assets/images/Guillemots.webp"
import ferry from "../assets/images/isle-of-sark-shipping-company.webp"


import '../css/home.css'

function Home() {

    // The photos row: every photo with a description for people who can't see it, and its size
    const images = [
        { src: gallery1, alt: 'Non Pareil in the Creux Harbour', width: 1299, height: 974 },
        { src: gallery2, alt: 'Non Pareil, our old boat, returning to the harbour, kayaks in front', width: 1299, height: 974 },
        { src: gallery3, alt: 'Entering Moie du Mouton sea cave', width: 1920, height: 1440 },
        { src: gallery4, alt: 'Looking out from inside the Moie du Mouton sea cave', width: 1920, height: 2560 },
        { src: gallery5, alt: 'Private charter swimming in sheltered gully', width: 1920, height: 2550 },
        { src: gallery6, alt: 'Two bottlenose dolphins swimming beside the boat', width: 1920, height: 2560 },
        { src: gallery7, alt: 'Razorbills on the Grande Moie, an offshore rock', width: 1920, height: 1080 },
        { src: gallery8, alt: 'Private charter tour to Derrible bay', width: 1920, height: 1423 },
        { src: gallery9, alt: 'Inside the Moie du Mouton sea cave', width: 1920, height: 1279 },
        { src: gallery10, alt: 'Drone view of Les Autelets', width: 1920, height: 1279 },
        { src: gallery11, alt: 'Private charter tour to a sheltered bay', width: 1920, height: 2550 },
        { src: cave, alt: 'Tour group inside the Moie du Mouton sea cave', width: 1920, height: 1280 },
    ]

    // The charter price the owner set on the dashboard (none until it is set or while it loads)
    const { prices } = usePrices()
    const charterPrice = prices?.charter ? formatPounds(prices.charter) : null

    return (<>
        <title>Sark Boat Trips</title>
        <meta name="description" content="Explore the beautiful coastline of Sark with Sark Boat Trips unforgettable boat tours. Discover stunning scenery, exciting marine life and create lasting memories. Book now!"></meta>
        <meta name="keywords" content="boat tours, Sark boat trips, birdwatching tours, dolphin watching, private boat charters, family friendly tours"></meta>
        <main id="main-content">
            <section id='heroBanner' className="hero-banner" aria-label="Hero">
                <span>
                    <h1>THE BEST WAY TO SEE SARK</h1>
                    <h2>BOAT TOURS WITH SARK LOCALS</h2>
                </span>
                <a href='#reservations' >
                    {/* <!-- From Uiverse.io by adamgiebl -->  */}
                    <button className="cssbuttons-io-button" aria-label="Book your tour now">
                        Book now!
                        <div className="icon" aria-hidden="true">
                            <svg
                                height="24"
                                width="24"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M0 0h24v24H0z" fill="none"></path>
                                <path
                                    d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"
                                    fill="currentColor"
                                ></path>
                            </svg>
                        </div>
                    </button>
                </a>
            </section>
            {/* The video and the photos, one row (owner, 5 Nov 2026) */}
            <Slideshow images={images} />
            {/* The tour, the reviews and the boat (owner, 2 Nov 2026): the facts and price up front, in the
                same style as the charters section. The trip prices come from the dashboard. */}
            <section id='theTour' className='theTour homeSection' aria-labelledby="tour-heading">
                <div className='sectionIntro'>
                    <p className='eyebrow'>The tour</p>
                    <h2 id="tour-heading">Two and a half hours around Sark</h2>
                    <p className='lead'>A leisurely trip right round the island from the Creux Harbour, the original fishing
                        port on Sark, exploring the bays, coves and secret caves.</p>
                </div>
                <dl className='tourFacts'>
                    <div><dt>2½ hours</dt><dd>right round the island</dd></div>
                    <div><dt>11am and 2pm</dt><dd>daily, weather permitting</dd></div>
                    <div><dt>Max 12</dt><dd>people on board</dd></div>
                    {prices ? <div><dt>{formatPounds(prices.adult)} adult</dt><dd>{formatPounds(prices.child)} child, under 4s free</dd></div> : null}
                </dl>
                <ul className='tourCards'>
                    <li>
                        <img src={guillemots} alt='Guillemots on the water beside the boat' loading='lazy' width='1920' height='1082' />
                        <div><h3>Seabirds</h3><p>In season: puffins, guillemots, razorbills and fulmars.</p></div>
                    </li>
                    <li>
                        <img src={gallery6} alt='Two dolphins swimming beside the boat' loading='lazy' width='1920' height='2560' />
                        <div><h3>Dolphins and seals</h3><p>Keep a look out for them, and other marine life.</p></div>
                    </li>
                    <li>
                        <img src={gallery9} alt='Inside the Moie du Mouton sea cave' loading='lazy' width='1920' height='1279' />
                        <div><h3>Caves and gullies</h3><p>A 10m tide means every trip is different.</p></div>
                    </li>
                </ul>
            </section>

            <Reviews />

            <section className='boatSection homeSection' aria-labelledby="boat-heading">
                <img src={dorado} alt='The Dorado in the harbour, passengers on board' loading='lazy' width='1600' height='747' />
                <div>
                    <p className='eyebrow'>The boat</p>
                    <h2 id="boat-heading">Meet the Dorado</h2>
                    <p className='lead'>A 25ft Treeve Marine built in 1980, she ran tours round Sark until the 90s, when she
                        was converted for fishing. After the loss of Non Pareil, our much loved wooden Sark-built boat, we
                        rebuilt Dorado in 2024 as a tour boat once again.</p>
                    <ul className='factChips' aria-label='On board'>
                        <li>Max 12 passengers</li>
                        <li>Toilet on board</li>
                        <li>Full safety equipment</li>
                    </ul>
                </div>
            </section>
            {/* Charters (owner's choices, 1 Nov 2026): the basics up front, the price from the dashboard */}
            <section id='charters' className="charters chartersIntro" aria-labelledby="charters-heading">
                <img src={charters} alt='A charter group swimming and paddleboarding from the boat in a quiet bay' loading='lazy' width='1080' height='864' />
                <div>
                    <p className='eyebrow'>Private charters</p>
                    <h2 id="charters-heading">Have the boat to yourselves</h2>
                    <p className='lead'>For a family, a group of friends or a special occasion: a secluded bay, the seabird
                        colonies, or an evening cruise. Paddleboards and snorkelling gear are included, and we can arrange
                        a packed lunch.</p>
                    <ul className='factChips' aria-label='Charter at a glance'>
                        <li>Up to 12 people</li>
                        <li>About 3 hours</li>
                        {charterPrice ? <li>{charterPrice} for the boat</li> : null}
                    </ul>
                    <Link to='/charters' className='goldButton'>Charter ideas and booking →</Link>
                </div>
            </section>
            {/* Sark Island, short and practical for day visitors (owner, 2 Nov 2026) */}
            <section id='sarkIsland' className="sarkIsland homeSection" aria-labelledby="island-heading">
                <div className='sectionIntro'>
                    <p className='eyebrow'>Sark Island</p>
                    <h2 id="island-heading">A car-free island, 50 minutes from Guernsey</h2>
                    <p className='lead'>Sark is the world&apos;s first Dark Sky Island, with 22 miles of coves, caves and
                        cliffs. Come for the day, or stay a night or two.</p>
                </div>
                <div className='islandCards'>
                    <article>
                        <img src={ferry} alt='The Sark ferry under way' loading='lazy' width='1200' height='800' />
                        <div>
                            <h3>Coming for the day</h3>
                            <p>Ferries run daily from Guernsey and take 50 minutes. Our trips leave from the Creux Harbour,
                                a short walk from where the ferry comes in.</p>
                            <p><a className='textLink' href="https://www.sarkshipping.gg" target="_blank" rel="noopener noreferrer">
                                Ferry times and booking: sarkshipping.gg<span className='sr-only'> (opens in new tab)</span>
                            </a></p>
                        </div>
                    </article>
                    <article>
                        <img src={suesbnb} alt='Sue&apos;s B&amp;B, a cottage with a large garden' loading='lazy' width='1920' height='1280' />
                        <div>
                            <h3>Staying over: Sue&apos;s B&amp;B</h3>
                            <p>4-star rooms on the island, an award-winning garden, and a telescope for the dark skies.</p>
                            <p>Book by calling <a className='textLink' href='tel:+441481832107'>+44 1481 832107</a> or emailing{' '}
                                <a className='textLink' href='mailto:suebnbsark@gmail.com'>suebnbsark@gmail.com</a></p>
                        </div>
                    </article>
                </div>
            </section>

            {/* The booking section's own heading is "Book a trip"; this anchor is where Book now and the menu land */}
            <div id='reservations' className='reservations'>
                <Bookings />
            </div>

            {/* Gift vouchers (owner, 2 Nov 2026): a small band after the booking form, linking to their page */}
            <section className='giftBand' aria-labelledby='gift-heading'>
                <div>
                    <p className='eyebrow'>Gift vouchers</p>
                    <h2 id='gift-heading'>Give a trip around Sark</h2>
                    <p>For any number of people, or a private charter. Emailed straight away, or on a day you choose.</p>
                </div>
                <Link to='/gift-vouchers' className='goldButton'>Buy a gift voucher</Link>
            </section>
        </main>





    </>

    )
}

export default Home