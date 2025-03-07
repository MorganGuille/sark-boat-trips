import React from 'react'
import Bookings from '../components/bookings'

import '../css/charters.css'

import charterDerrible from '../assets/images/Charter+Tour+Derrible.jpeg'
import guillemots from "../assets/images/Guillemots.jpg"

function Charters() {
    return (<>
        <title>Sark Boat Trips | Charters</title>
        <meta name="description" content="Book a private charter tour with Sark Boat Trips! Explore Sarks facinating coastline, visit secluded bays and swim or SUP from the boat!"></meta>
        <meta name="keywords" content="Private Charter Tours, Beach explorers, Stand up paddle Board rental, Swimming trips"></meta>
        <section id="charters" className='charterTours' >
            <h2>CHARTER TOURS</h2>
            <div className='grid1'>
                <div><img width="600px" height="auto" src={charterDerrible} /></div>
                <div>
                    <h3>Beach Explorer</h3>
                    <p>Sark is known for its secluded, difficult to access, beaches.
                        So why not hire us to take to you there in comfort and perhaps visit a bay inaccessible by land.
                    </p>
                </div>
            </div>
            <div className='grid1'>
                <div>
                    <h3>Birdwatching</h3>
                    <p>In season we have resident colonies of Guillemots, Razorbills, Puffins and Fulmar.
                        Why not hire us for a trip out to their off-shore colonies and get up close and personal with these elusive seabirds.
                    </p>
                </div>
                <div><img width="600px" height="auto" src={guillemots} /></div>
            </div>
            <div>
                <h3>More ideas</h3>
                <p><strong>Evening cruise/early morning tour.</strong> If you’re looking for an unforgettable end to your day in Sark why not hire us for the evening and take a cruise around the island in the evening light.
                    Maybe with a glass of champagne to toast the day! </p>
                <p><strong>Safety boat.</strong> Whether you’re doing a long distance swim / exploring the island by kayak, safety is paramount. We can stay close and escort you around the island.
                    We also have a wealth of experience and knowledge of the tides around the island and can help you plan a safe route. </p>
                <h4>If you have any questions or ideas, please contact us and discuss options. We’re sure we can build you an adventure to remember!</h4>
                <h4>Or use the form below to book your charter trip! please note we require a (refundable) deposit of 20% to reserve a charter tour!</h4>
            </div>
        </section>

        <Bookings />


    </>

    )
}

export default Charters