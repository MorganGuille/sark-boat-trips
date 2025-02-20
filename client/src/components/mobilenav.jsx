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
        return currentLoc.pathname === '/charters' || currentLoc.pathname === '/dashboard';
    };


    return (
        <div className='mobileMenu'>
            <div className={`burger-icon ${menuOpen && 'menuOpen'}`} onClick={toggleMenu}>☰</div>

            <div className={`mobileLinks ${menuOpen && 'mobile-links-open'}`}>
                {!checkPage() ? (<a href='#heroBanner'>HOME</a>) : (<NavLink to={'./'}>HOME</NavLink>)}
                {!checkPage() ? (<a href='#theTour' >THE TOUR</a>) : (null)}
                {!checkPage() ? (<a href='#charters' >CHARTERS</a>) : (null)}
                {!checkPage() ? (<a href='#sarkIsland' >SARK ISLAND</a>) : (null)}
                {!checkPage() ? (<a href='#reviews' >REVIEWS</a>) : (null)}
                {!checkPage() ? (<a href='#reservations' >RESERVATIONS</a>) : (null)}
            </div>


        </div>
    )
}

export default MobileNav