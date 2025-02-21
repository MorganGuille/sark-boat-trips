import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import '../css/navbar.css'

function Navbar() {

    /// logic for setting sticky / unsticky navbar below

    const [stickyClass, setStickyClass] = useState('');

    useEffect(() => {
        window.addEventListener('scroll', stickNavbar);
        return () => window.removeEventListener('scroll', stickNavbar);
    }, []);

    const stickNavbar = () => {
        if (window !== undefined) {
            let windowHeight = window.scrollY;
            windowHeight > 850 ? setStickyClass('sticky-nav') : setStickyClass('');
        }
    };

    /// logic for showing / hiding navlinks below

    let currentLoc = useLocation()

    const checkPage = () => {
        return currentLoc.pathname === '/charters' || currentLoc.pathname === '/dashboard'
    }

    useEffect(() => {
        checkPage()
    }, [currentLoc]);

    return (<>

        <div className={`navbar ${stickyClass}`}>

            {!checkPage() ? (<a href='#heroBanner'>HOME</a>) : (<NavLink to={'./'}>HOME</NavLink>)}
            {!checkPage() ? (<a href='#theTour' >THE TOUR</a>) : (null)}
            {!checkPage() ? (<a href='#charters' >CHARTERS</a>) : (null)}
            {!checkPage() ? (<a href='#sarkIsland' >SARK ISLAND</a>) : (null)}
            {!checkPage() ? (<a href='#reviews' >REVIEWS</a>) : (null)}
            {!checkPage() ? (<a href='#reservations' >RESERVATIONS</a>) : (null)}

        </div>


    </>
    )
}

export default Navbar