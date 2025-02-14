import React, { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import '../css/navbar.css'



function Navbar() {


    let currentLoc = useLocation()

    const checkPage = () => {
        // let homepage = ['#theTour', '#charters', '#sarkIsland', '#reviews', '#reservations']
        return currentLoc.pathname === '/charters'
    }

    useEffect(() => {
        checkPage()
    }, [currentLoc]);

    return (<>

        <div className="navbar">



            {!checkPage() ? (<a href='#theTour' >THE TOUR</a>) : (null)}
            {!checkPage() ? (<a href='#charters' >CHARTERS</a>) : (null)}
            {!checkPage() ? (<a href='#heroBanner'>HOME</a>) : (<NavLink to={'./'}>HOME</NavLink>)}
            {!checkPage() ? (<a href='#sarkIsland' >SARK ISLAND</a>) : (null)}
            {!checkPage() ? (<a href='#reviews' >REVIEWS</a>) : (null)}
            {!checkPage() ? (<a href='#reservations' >RESERVATIONS</a>) : (null)}






        </div>


    </>
    )
}

export default Navbar