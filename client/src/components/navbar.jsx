import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import usePage from '../hooks/usePage'
import '../css/navbar.css'

function Navbar() {

    /// logic for setting sticky / unsticky navbar below

    const [stickyClass, setStickyClass] = useState('');

    const stickNavbar = () => {
        if (window !== undefined) {
            let scrollPosition = window.scrollY;
            scrollPosition > 850 ? setStickyClass('sticky-nav') : setStickyClass('');
        }
    };

    useEffect(() => {
        window.addEventListener('scroll', stickNavbar);
        return () => window.removeEventListener('scroll', stickNavbar);
    }, []);

    /// logic for showing / hiding navlinks below

    const page = usePage()

    // The sections are on the home page: from any other page (terms, booking, manage...) go there first
    const section = (id) => (page === '/' ? `#${id}` : `/#${id}`)

    const checkPage = () => {
        return page === '/charters' || page === '/dashboard' || page === '/success' || page === '/canceled'
    }

    useEffect(() => {
        checkPage()
    }, [page]);

    return (<>

        <header className={`navbar ${stickyClass}`}>
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <nav className="navbar" aria-label="Primary Navigation">
                {!checkPage() ? (<a href={section('heroBanner')}>HOME</a>) : (<NavLink to={'./'}>HOME</NavLink>)}
                {!checkPage() ? (<a href={section('theTour')} >THE TOUR</a>) : (null)}
                {!checkPage() ? (<a href={section('charters')} >CHARTERS</a>) : (null)}
                {!checkPage() ? (<a href={section('sarkIsland')} >SARK ISLAND</a>) : (null)}
                {!checkPage() ? (<a href={section('reviews')} >REVIEWS</a>) : (null)}
                {!checkPage() ? (<a href={section('reservations')} >RESERVATIONS</a>) : (null)}
            </nav>

        </header>


    </>
    )
}

export default Navbar