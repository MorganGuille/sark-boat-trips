import React from 'react'
import Slideshow from '../components/slideshow'
import Reviews from '../components/reviews'
import Bookings from '../components/bookings'
import { NavLink } from 'react-router'


import '../css/home.css'

function Home() {

    const images = [
        '../src/assets/images/gallery1.jpg',
        '../src/assets/images/gallery2.jpg',
        '../src/assets/images/gallery3.jpg',
        '../src/assets/images/gallery4.jpg',
        '../src/assets/images/gallery5.jpg',
        '../src/assets/images/gallery6.jpg',
        '../src/assets/images/gallery7.jpg',
        '../src/assets/images/gallery8.jpeg',
        '../src/assets/images/gallery9.jpeg',
        '../src/assets/images/gallery10.jpeg',
        '../src/assets/images/gallery11.jpg',
    ]

    return (<>
        <section id='heroBanner' className="hero-banner">
            <span>
                <h1>THE BEST WAY TO SEE SARK</h1>
                <h3>BOAT TRIPS WITH SARK LOCALS</h3>
            </span>
            <a href='#reservations' ><button>Book now</button></a>
        </section>
        <section id='theTour' className='theTour'>
            <div className="content">
                <h2>THE TOUR</h2>
                <p>Departing from the ‘Creux’ Harbour, the original fishing port on Sark we will take a leisurely two
                    and a half hour trip around the Island, exploring the bays, coves and secret caves. In season you
                    can see sea birds such as puffins, guillemots, razor-bills, cormorants and many others. There is
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
        <section id='charters' className="charters">
            <div className="content">
                <h2>CHARTERS</h2>
                <p>If you are a larger group and/or would just like the boat to yourself we can also arrange charter
                    trips.
                    We can also do specific tours, such as a 1 hr trip to see the sea birds of L’Etac, an early morning
                    or
                    late evening trip, or perhaps you fancy a trip around to one of Sark’s secluded bays. We can provide
                    SUP’s, snorkeling gear and even a packed lunch. Please contact us by email to
                    sarkboattrips@gmail.com or
                    by calling +44 7911 764 246 and we will arrange a tour to suit you.</p>

                <p>For more information and ideas</p>
                <NavLink to={'./charters'}><button>Click Here</button></NavLink>
            </div>
            <img src={"../src/assets/images/charters.jpg"} alt='Charter trip inside cave' />
        </section>
        <section id='sarkIsland' className="sarkIsland">
            <h2>SARK ISLAND</h2>

            <div className="grid1 textGrid">
                <div>
                    <h3>Sark is the crown jewel of the Channel Islands, nestled in between Guernsey and Jersey.</h3>
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
                    <h3>Did you know?:</h3>
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
                    <img width="500px" height="auto" src={"../src/assets/images/isle-of-sark-shipping-company.jpg"} />
                </div>
            </div>

            <div className="grid1">
                <div><img width="500px" height="auto" src={"../src/assets/images/SuesbnbextGeorge.jpg"} /></div>
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

        <section id="reservations" className="reservations">
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