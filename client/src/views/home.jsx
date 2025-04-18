import React from 'react'
import Slideshow from '../components/slideshow'
import Reviews from '../components/reviews'
import Bookings from '../components/bookings'
import VideoPlayer from '../components/videoPlayer'

import { NavLink } from 'react-router'

import gallery1 from '../assets/images/gallery1.jpg'
import gallery2 from '../assets/images/gallery2.jpg'
import gallery3 from '../assets/images/gallery3.jpg'
import gallery4 from '../assets/images/gallery4.jpg'
import gallery5 from '../assets/images/gallery5.jpg'
import gallery6 from '../assets/images/gallery6.jpg'
import gallery7 from '../assets/images/gallery7.jpg'
import gallery8 from '../assets/images/gallery8.jpeg'
import gallery9 from '../assets/images/gallery9.jpeg'
import gallery10 from '../assets/images/gallery10.jpeg'
import gallery11 from '../assets/images/gallery11.jpg'

import charters from "../assets/images/charters.jpg"
import sarkShipping from "../assets/images/isle-of-sark-shipping-company.jpg"
import suesbnb from "../assets/images/SuesbnbextGeorge.jpg"


import '../css/home.css'

function Home() {

    const images = [
        gallery1,
        gallery2,
        gallery3,
        gallery4,
        gallery5,
        gallery6,
        gallery7,
        gallery8,
        gallery9,
        gallery10,
        gallery11,
    ]

    return (<>
        <title>Sark Boat Trips</title>
        <meta name="description" content="Explore the beautiful coastline of Sark with Sark Boat Trips unforgettable boat tours. Discover stunning scenery, exciting marine life and create lasting memories. Book now!"></meta>
        <meta name="keywords" content="boat tours, Sark boat trips, birdwatching tours, dolphin watching, private boat charters, family friendly tours"></meta>
        <section id='heroBanner' className="hero-banner">
            <span>
                <h1>THE BEST WAY TO SEE SARK</h1>
                <h3>BOAT TOURS WITH SARK LOCALS</h3>
            </span>
            <a href='#reservations' >
                {/* <!-- From Uiverse.io by adamgiebl -->  */}
                <button className="cssbuttons-io-button">
                    Book now!
                    <div className="icon">
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
        <section className="centered-section">
            <VideoPlayer />
        </section>
        <section id='theTour' className='theTour centered-section'>
            <div className="content">
                <h2>THE TOUR</h2>
                <p>Departing from the ‘Creux’ Harbour, the original fishing port on Sark we will take a leisurely two
                    and a half hour trip around the Island, exploring the bays, coves and secret caves.</p>
                <p> In season you
                    can see our sea birds such as puffins, guillemots, razor-bills, cormorants and many others. There is
                    also the chance of seeing some of Sark’s other sea life such as dolphins and seals, even basking
                    sharks and sunfish.</p>
                <p>We usually run two trips daily, at 11am and 2pm weather dependent. </p>
            </div>
            <div className="content">
                <h2>THE BOAT</h2>
                <p>Rebuilt in 2024, the Dorado is a purpose built Treeve Marine 25’ , one of the most successful British
                    built boats. She was commissioned in 1980 for Dominic Wakey who ran tours around the island until
                    the mid 90’s when he refitted the Dorado as a fishing boat.</p>
                <p>After the loss of Non Pareil, our much loved wooden Sark built boat, we have restored the Dorado as
                    a tour boat once again! She is a 25ft GRP hull and comfortably carries up to 12 passengers. On board
                    is a toilet and full safety equipment including life jackets and lifeboats for all passengers and
                    crew.</p>
            </div>
        </section >
        <Slideshow images={images} />
        <section id='charters' className="charters centered-section">
            <div className="content">
                <h2>CHARTERS</h2>
                <h4>Did you know we do charters?</h4>
                <p>If you are a larger group and/or would just like the boat to yourself we can arrange a charter
                    tour!
                    We can do specific tours such as; a tour to see the sea birds of L’Etac, an early morning
                    / late evening cruise.</p>
                <p> Or perhaps you fancy a trip around to one of Sark’s secluded bays. We can provide
                    SUP’s, snorkeling gear and even a packed lunch.</p>
                <p>For more information and ideas for a charter to suit you, please click below.</p>
                <NavLink to={'/charters'}><button className='btn'>Discover more and book yours</button></NavLink>
            </div>
            <img src={charters} alt='Charter trip inside cave' />
        </section>
        <section id='sarkIsland' className="sarkIsland centered-section">
            <h2>SARK ISLAND</h2>

            <div className="grid1 textGrid">
                <div>
                    <h4>Sark is the crown jewel of the Channel Islands, nestled in between Guernsey and Jersey.</h4>
                    <p>Sark offers a truly unique holiday experience for those wanting to escape the bright lights and
                        noise
                        of
                        the city. A visit to our car-free island is like a step back in time and visitors are sure to be
                        blown
                        away by the stunning scenery, bays, coastal paths and cliff top views.</p>
                    <p>Sark is also the world's first 'Dark Sky' Island, offering spectacular star gazing throughout the
                        year
                        and the Goliout headland is a world recognized Ramsar site</p>
                    <p>The Island's 22 mile coastline is a treasure trove of small coves, creeks, caves, inlets and
                        bays,
                        all
                        teaming with sea life both above and below the water. </p>
                </div>

                <div>
                    <h4>Did you know?:</h4>
                    <p>Sark has a tidal range of around 10m. which means no trip around the island will be the same, on
                        some
                        tides we can access caves, on others we can get within touching distance of some of the
                        off-shore
                        rocks.
                    </p>
                    <p>On a ‘Spring low’ tide we can show you some of the many scrambling routes on Sark.</p>
                </div>
            </div>

            <div className="grid1">
                <div>
                    <h2>GETTING HERE</h2>
                    <p>Just a 50 minute boat ride from Guernsey, Sark feels an entire world away. Several ferries run
                        daily during summer with daily trips during off season.</p>

                    <p>Visit the Isle of Sark shipping website for more info and online booking</p>
                    <a href="https://www.sarkshipping.gg" target="_blank">
                        <p>www.sarkshipping.gg</p>
                    </a>
                </div>
                <div>
                    <img src={sarkShipping} />
                </div>
            </div>

            <div className="grid1">
                <div><img src={suesbnb} /></div>
                <div>
                    <h2>SUE'S BNB</h2>
                    <p>We also offer 4* accommodation on the island at Sue’s BnB,</p>
                    <p>‘Sue's B&B is the perfect place for settling into Sark life. Relax in the award winning garden on
                        sunny days or use it as a base to explore the sandy beaches and hidden caves and at night
                        explore the galaxy with our telescope’</p>

                    <p>Book by calling +44 1481 832107 or emailing suebnbsark@gmail.com</p>
                </div>

            </div>
        </section>

        <Reviews />
        <section id='reservations' className="reservations centered-section">
            <h2>RESERVATIONS</h2>
            <p>Please note that we do not charge a deposit online - so if your plans change please let us know asap so
                we can rearrange your seat. Payment is on the day, at the end of the trip - either in cash or by card.
            </p>
        </section>

        <Bookings />





    </>

    )
}

export default Home