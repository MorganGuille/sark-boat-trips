import React from 'react'
import Charters from '../components/charters';
import '../css/home.css'

function Home() {
    return (<>
        <section className="hero-banner">
            <h1>THE BEST WAY TO SEE SARK</h1>
            <h3>BOAT TRIPS WITH SARK LOCALS</h3>
        </section>
        <Charters />
    </>

    )
}

export default Home