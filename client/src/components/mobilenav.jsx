import { useState } from 'react'
import { NavLink } from 'react-router'
import usePage from '../hooks/usePage'
import '../css/navbar.css'

function MobileNav() {

    const [menuOpen, setMenuOpen] = useState(false);

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const page = usePage();

    // The sections are on the home page: from any other page (terms, booking, manage...) go there first
    const section = (id) => (page === '/' ? `#${id}` : `/#${id}`)

    const checkPage = () => {
        return page === '/charters' || page === '/dashboard' || page === '/success' || page === '/canceled'
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
                {!checkPage() ? (<a href={section('heroBanner')}>HOME</a>) : (<NavLink to={'./'}>HOME</NavLink>)}
                {!checkPage() ? (<a href={section('theTour')} >THE TOUR</a>) : (null)}
                {!checkPage() ? (<a href={section('charters')} >CHARTERS</a>) : (null)}
                {!checkPage() ? (<a href={section('sarkIsland')} >SARK ISLAND</a>) : (null)}
                {!checkPage() ? (<a href={section('reviews')} >REVIEWS</a>) : (null)}
                {!checkPage() ? (<a href={section('reservations')} >RESERVATIONS</a>) : (null)}
            </div>


        </nav>
    )
}

export default MobileNav