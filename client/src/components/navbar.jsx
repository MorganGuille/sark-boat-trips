import React from 'react'
// import { NavLink } from 'react-router'
import { Link, NavLink } from 'react-router-dom';
import '../css/navbar.css'



function Navbar() {
    return (<>

        <div className="navbar">

            <NavLink to={'./'}>SARK BOAT TRIPS</NavLink>
            <NavLink to={'./Bookings'}>BOOKINGS</NavLink>
            <Link to={'#theTour'} >THE TOUR</Link>




        </div>


    </>
    )
}

export default Navbar