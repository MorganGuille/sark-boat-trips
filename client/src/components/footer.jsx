import { Link } from 'react-router'
import '../css/footer.css'

import usePage from '../hooks/usePage'
import logo from '../assets/logos/Boat-Trips-Logo.png'
import googleLogo from '../assets/logos/googleIcon.png'
import tripLogo from '../assets/logos/tripadvisorIcon.png'
import faceLogo from '../assets/logos/facebookIcon.png'
import instaLogo from '../assets/logos/instagramIcon.png'
import { CONTACT_EMAIL, CONTACT_PHONE, PHONE_LINK } from '../utils/contact.js'

const SOCIAL = [
    { name: 'Facebook', label: 'Visit our Facebook page', href: 'https://www.facebook.com/sarkboattrips', logo: faceLogo },
    { name: 'Instagram', label: 'Visit our Instagram profile', href: 'https://www.instagram.com/sark_boat_trips/', logo: instaLogo },
    { name: 'Tripadvisor', label: 'Read our reviews on Tripadvisor', href: 'https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html', logo: tripLogo },
    { name: 'Google', label: 'Find us on Google', href: 'https://g.co/kgs/RsJniax', logo: googleLogo },
]

// The footer on every page: who we are with a Book button, the page links, how to reach us, and the
// social links. No address: there is nowhere for customers to visit (owner, 1 Nov 2026).
function Footer() {
    const page = usePage()
    const home = page === '/'
    const section = (id) => (home ? `#${id}` : `/#${id}`)

    return (
        <footer className='siteFooter'>
            <div className='footerGrid'>
                <div className='footerAbout'>
                    <Link to='/' className='footerBrand'>
                        <img src={logo} alt='' width='40' height='37' />
                        <span>Sark Boat Trips</span>
                    </Link>
                    <p>Discover Sark from the sea. Guided boat tours with local skippers.</p>
                    <a href={home ? '#reservations' : '/bookings'} className='footerBook'>Book a trip</a>
                </div>

                <div className='footerContact'>
                    <h2>Contact</h2>
                    <p><small>Call or WhatsApp</small><a href={PHONE_LINK}>{CONTACT_PHONE}</a></p>
                    <p><small>Email</small><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                </div>

                <nav className='footerExplore' aria-label='Explore'>
                    <h2>Explore</h2>
                    <ul>
                        <li><a href={section('theTour')}>The tour</a></li>
                        <li><a href={section('reviews')}>Reviews</a></li>
                        <li><a href={section('charters')}>Charters</a></li>
                        <li><a href={section('sarkIsland')}>Sark Island</a></li>
                        <li><Link to='/gift-vouchers'>Gift vouchers</Link></li>
                    </ul>
                </nav>

                <nav className='footerSocial' aria-label='Social media'>
                    <h2>Follow us</h2>
                    <ul>
                        {SOCIAL.map((site) => (
                            <li key={site.name}>
                                <a href={site.href} target='_blank' rel='noopener noreferrer' aria-label={site.label}>
                                    <img src={site.logo} alt='' width='24' height='24' />
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>

            <div className='footerBottom'>
                {/* the year as the visitor's browser has it (the page is built ahead, perhaps last year) */}
                <span suppressHydrationWarning>&copy; {new Date().getFullYear()} Sark Boat Trips</span>
                <nav aria-label='Legal'>
                    <Link to='/terms'>Terms and conditions</Link>
                    <Link to='/privacy'>Privacy policy</Link>
                </nav>
            </div>
        </footer>
    )
}

export default Footer
