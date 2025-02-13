import React from 'react'
import { NavLink } from 'react-router'
import '../css/navbar.css'



function Navbar() {
    return (<>

        <div className="navbar">

            <NavLink to={'./'}>SARK BOAT TRIPS</NavLink>
            <NavLink to={'./Bookings'}>BOOKINGS</NavLink>
            <a href='#theTour' >THE TOUR</a>




        </div>


    </>
    )
}

export default Navbar