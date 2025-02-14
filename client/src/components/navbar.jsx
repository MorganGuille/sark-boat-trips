import React from 'react'
import { NavLink } from 'react-router'
import '../css/navbar.css'



function Navbar() {
    return (<>

        <div className="navbar">


            <a href='#heroBanner' >HOME</a>
            <a href='#theTour' >THE TOUR</a>
            <a href='#charters' >CHARTERS</a>
            <NavLink to={'./'}>SARK BOAT TRIPS</NavLink>
            <a href='#sarkIsland' >SARK ISLAND</a>
            <a href='#reviews' >REVIEWS</a>
            <NavLink to={'./bookings'}>RESERVATIONS</NavLink>




        </div>


    </>
    )
}

export default Navbar