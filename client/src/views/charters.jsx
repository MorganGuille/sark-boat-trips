import React from 'react'
import Bookings from '../components/bookings'

import '../css/charters.css'

import charterDerrible from '../assets/images/Charter+Tour+Derrible.webp'
import guillemots from "../assets/images/Guillemots.webp"

function Charters() {
    return (<>
        <title>Sark Boat Trips | Charters</title>
        <meta name="description" content="Book a private charter tour with Sark Boat Trips! Explore Sarks facinating coastline, visit secluded bays and swim or SUP from the boat!"></meta>
        <meta name="keywords" content="Private Charter Tours, Beach explorers, Stand up paddle Board rental, Swimming trips"></meta>
        <main id="main-content">
            <section id="charters" className='charterTours' aria-labelledby="charters-title" >
                <h2 id="charters-title">CHARTER TOURS</h2>
                <article className='grid1' aria-labelledby="beach-explorer-title">
                    <div>
                        <img
                            width="600px"
                            height="auto"
                            src={charterDerrible}
                            alt="Dorado boat anchored at Derrible Bay beach"
                        />
                    </div>
                    <div>
                        <h3 id="beach-explorer-title">Beach Explorer</h3>
                        <p>Sark is known for its secluded, difficult to access, beaches.
                            So why not hire us to take to you there in comfort and perhaps visit a bay inaccessible by land.
                        </p>
                    </div>
                </article>
                <article className='grid1' aria-labelledby="birdwatching-title">
                    <div>
                        <h3 id="birdwatching-title">Birdwatching</h3>
                        <p>In season we have resident colonies of Guillemots, Razorbills, Puffins and Fulmar.
                            Why not hire us for a trip out to their off-shore colonies and get up close and personal with these elusive seabirds.
                        </p>
                    </div>
                    <div>
                        <img
                            width="600px"
                            height="auto"
                            src={guillemots}
                            alt="Group of Guillemots nesting on a coastal cliff"
                        />
                    </div>
                </article>
                <h3>More ideas</h3>
                <section aria-labelledby="more-ideas-title">
                    <h3 id="more-ideas-title">More ideas</h3>
                    <div className='grid1'>
                        <p>
                            <strong>Evening cruise/early morning tour.</strong> If you’re looking for an unforgettable end to your day in Sark why not hire us for the evening and take a cruise around the island in the evening light.
                            Maybe with a glass of champagne to toast the day!
                        </p>
                        <p>
                            <strong>Safety boat.</strong> Whether you’re doing a long distance swim / exploring the island by kayak, safety is paramount. We can stay close and escort you around the island.
                            We also have a wealth of experience and knowledge of the tides around the island and can help you plan a safe route.
                        </p>
                    </div>

                    <div className="charter-notice">
                        <h4>If you have any questions or ideas, please contact us and discuss options. We’re sure we can build you an adventure to remember!</h4>
                        <h4>Or use the form below to book your charter trip! Please note we require a (refundable) deposit of 20% to reserve a charter tour!</h4>
                    </div>
                </section>
            </section>

            <Bookings />
        </main>


    </>

    )
}

export default Charters