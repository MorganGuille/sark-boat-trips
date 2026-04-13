import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import '../css/navbar.css'

function MobileNav() {

    const [menuOpen, setMenuOpen] = useState(false);

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    let currentLoc = useLocation();

    const checkPage = () => {
        return currentLoc.pathname === '/charters' || currentLoc.pathname === '/dashboard' || currentLoc.pathname === '/success' || currentLoc.pathname === '/canceled'
    };


    return (
        <nav
            className={`${menuOpen ? 'mobileNavOpen' : 'mobileNavClosed'}`}
            aria-label="Mobile Navigation">
            <button onClick={toggleMenu}
                className={`burgerIcon ${menuOpen && 'burgerIconOpen'} `}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu-links">☰</button>
            <div
                id="mobile-menu-links"
                className={`mobileLinks ${menuOpen ? 'linksOpen' : 'linksClosed'}`}
                aria-hidden={!menuOpen}
            >
                {!checkPage() ? (<a href='#heroBanner'>HOME</a>) : (<NavLink to={'./'}>HOME</NavLink>)}
                {!checkPage() ? (<a href='#theTour' >THE TOUR</a>) : (null)}
                {!checkPage() ? (<a href='#charters' >CHARTERS</a>) : (null)}
                {!checkPage() ? (<a href='#sarkIsland' >SARK ISLAND</a>) : (null)}
                {!checkPage() ? (<a href='#reviews' >REVIEWS</a>) : (null)}
                {!checkPage() ? (<a href='#reservations' >RESERVATIONS</a>) : (null)}
            </div>


        </nav>
    )
}

export default MobileNav