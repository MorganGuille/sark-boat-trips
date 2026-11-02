import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import usePage from '../hooks/usePage'
import { CONTACT_EMAIL, CONTACT_PHONE, PHONE_LINK } from '../utils/contact.js'
import logo from '../assets/logos/Boat-Trips-Logo.png'
import '../css/navbar.css'

// The site's header, the same on every page. On a laptop: the logo and name (home), the links and a
// Book a trip button. Every link goes to a section of the home page (the owner found it jarring when
// Charters alone opened another page; the charters section links to the charter page). At the top of the home page it is see-through over the photo, and turns white
// once you scroll (owner's choice, option A). Below 1020px: a slim white bar with a Book button and a
// menu button that opens the links over the whole screen.
function Navbar() {
    const page = usePage()
    const home = page === '/'
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuButton = useRef(null)
    const closeButton = useRef(null)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const closeMenu = () => {
        setMenuOpen(false)
        menuButton.current?.focus()
    }

    // While the menu is open, Escape closes it. (The page behind isn't frozen: the menu covers it, and
    // freezing it stopped iPhones scrolling to the section a menu link goes to.)
    useEffect(() => {
        if (!menuOpen) return
        closeButton.current?.focus()
        const onKey = (e) => { if (e.key === 'Escape') closeMenu() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [menuOpen])

    // The sections are on the home page: from any other page go there first
    const section = (id) => (home ? `#${id}` : `/#${id}`)
    // On the home page the booking form is further down it; elsewhere, the booking page
    const bookHref = home ? '#reservations' : '/bookings'
    const toTop = () => { if (home) window.scrollTo({ top: 0 }) }

    // A link in the phone menu closes it. On the home page it also scrolls to the section itself: closing the
    // menu switches its links off (inert), and iPhones then skipped the link's own jump to the section.
    const fromMenu = (id) => (e) => {
        setMenuOpen(false)
        if (!home || !id) return
        e.preventDefault()
        document.getElementById(id)?.scrollIntoView()
        window.history.pushState(null, '', `#${id}`)
    }

    // inMenu: the phone menu's copy of the links. In the order of the home page's sections.
    const links = (inMenu) => (<>
        <a href={section('theTour')} onClick={inMenu ? fromMenu('theTour') : undefined}>The tour</a>
        <a href={section('reviews')} onClick={inMenu ? fromMenu('reviews') : undefined}>Reviews</a>
        <a href={section('charters')} onClick={inMenu ? fromMenu('charters') : undefined}>Charters</a>
        <a href={section('sarkIsland')} onClick={inMenu ? fromMenu('sarkIsland') : undefined}>Sark Island</a>
    </>)

    return (
        <header className={`siteHeader${home && !scrolled ? ' overPhoto' : ''}`}>
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <div className='headerBar'>
                <Link to='/' className='brand' onClick={toTop}>
                    <img src={logo} alt='' width='40' height='37' />
                    <span>Sark Boat Trips</span>
                </Link>
                <nav className='headerLinks' aria-label='Main'>
                    {links()}
                </nav>
                <a href={bookHref} className='bookButton'>
                    {/* a fixed space: the button lays its parts out side by side, which drops an ordinary one */}
                    Book<span className='bookWide'>&nbsp;a trip</span>
                </a>
                <button type='button' className='menuButton' ref={menuButton} onClick={() => setMenuOpen(true)}
                    aria-label='Open menu' aria-expanded={menuOpen} aria-controls='mobile-menu'>
                    <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 7h16M4 12h16M4 17h16' /></svg>
                </button>
            </div>

            {/* The phone menu, over the whole screen. inert while closed, so it can't be tabbed into. */}
            <div id='mobile-menu' className={`mobileMenu${menuOpen ? ' open' : ''}`} inert={!menuOpen}>
                <div className='headerBar'>
                    <Link to='/' className='brand' onClick={() => { setMenuOpen(false); toTop() }}>
                        <img src={logo} alt='' width='40' height='37' />
                        <span>Sark Boat Trips</span>
                    </Link>
                    <button type='button' className='menuButton' ref={closeButton} onClick={closeMenu} aria-label='Close menu'>
                        <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18' /></svg>
                    </button>
                </div>
                <nav className='mobileLinks' aria-label='Menu'>
                    {links(true)}
                </nav>
                <a href={bookHref} className='bookButton' onClick={fromMenu('reservations')}>Book a trip</a>
                <p className='menuContact'>
                    Call or WhatsApp <a href={PHONE_LINK}>{CONTACT_PHONE}</a><br />
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                </p>
            </div>
        </header>
    )
}

export default Navbar
