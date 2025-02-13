import React from 'react'
import Slideshow from '../components/slideshow'


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
        <section className="hero-banner">
            <h1>THE BEST WAY TO SEE SARK</h1>
            <h3>BOAT TRIPS WITH SARK LOCALS</h3>
            <button>Book now</button>
        </section>
        <section id='theTour' className='theTour'>
            <div className="content">
                <h2>THE TOUR</h2>
                <p>Departing from the ‘Creux’ Harbour, the original fishing port on Sark we will take a leisurely two
                    and a half hour trip around the Island, exploring the bays, coves and secret caves. In season you
                    can see sea birds such as puffins, guillemots, razor-bills, cormorants and many others. There is
                    also the chance of seeing some of Sark’s other sea life such as dolphins and seals, even basking
                    sharks and sunfish.</p>
                <br />
                <p>We usually run two trips daily, at 11am and 2pm weather dependent. </p>
            </div>
            <div className="content">
                <h2>THE BOAT</h2>
                <p>Rebuilt in 2024, the Dorado is a purpose built Treeve Marine 25’ , one of the most successful British
                    built boats. She was commissioned in 1980 for Dominic Wakey who ran tours around the island until
                    the mid 90’s when he refitted the Dorado as a fishing boat.

                    After the loss of Non Pareil, our much loved wooden Sark built boat, we have restored the Dorado as
                    a tour boat once again! She is a 25ft GRP hull and comfortably carries up to 12 passengers. On board
                    is a toilet and full safety equipment including life jackets and lifeboats for all passengers and
                    crew.</p>
            </div>
        </section >
        <Slideshow images={images} />
        <section className="section3">
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
                <br />
                <p>For more information and ideas</p>
                <button>Click Here</button>
            </div>
            <img src={"../src/assets/images/charters.jpg"} alt='Charter trip inside cave' />
        </section>


    </>

    )
}

export default Home