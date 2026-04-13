import React, { useState } from 'react'
import '../css/footer.css'

import PrivacyPolicy from './privacyPolicy'
import Terms from './terms'

import googleLogo from '../assets/logos/googleIcon.png'
import tripLogo from '../assets/logos/tripadvisorIcon.png'
import faceLogo from '../assets/logos/facebookIcon.png'
import instaLogo from '../assets/logos/instagramIcon.png'

function Footer() {
    const [showPrivacyP, setshowPrivacyP] = useState(false)
    const [showTerms, setshowTerms] = useState(false)

    return (
        <footer>
            {showPrivacyP && (
                <>
                    <div
                        onClick={() => setshowPrivacyP(false)}
                        className="popUpBackground"
                        aria-hidden="true"
                    ></div>
                    <PrivacyPolicy close={() => setshowPrivacyP(false)} />
                </>
            )}

            {showTerms && (
                <>
                    <div
                        onClick={() => setshowTerms(false)}
                        className="popUpBackground"
                        aria-hidden="true"
                    ></div>
                    <Terms close={() => setshowTerms(false)} />
                </>
            )}

            <div className="footer-container">
                <address className="footer-section">
                    <a href="https://maps.google.com/?q=Sark+Boat+Trips+Dixcart+Ln+Sark" target='_blank' rel="noopener noreferrer">
                        Sark Boat Trips, Dixcart Ln, Sark, GY10, Guernsey
                    </a>
                    <a href="tel:+447911764246" aria-label="Call us at +44 7911 764 246">
                        +44 7911 764 246
                    </a>
                    <a href="mailto:sarkboattrips@gmail.com">sarkboattrips@gmail.com</a>
                </address>

                <div className="footer-section">
                    <button
                        className="footer-btn-link"
                        onClick={() => setshowPrivacyP(true)}
                        aria-haspopup="dialog"
                    >
                        Privacy Policy
                    </button>
                    <button
                        className="footer-btn-link"
                        onClick={() => setshowTerms(true)}
                        aria-haspopup="dialog"
                    >
                        Terms and Conditions
                    </button>
                </div>

                <nav className='footer-links' aria-label="Social Media Links">
                    <a href="https://www.facebook.com/sarkboattrips" target="_blank" rel="noopener noreferrer" aria-label="Visit our Facebook page">
                        <img width={'32px'} src={faceLogo} alt="Facebook" />
                    </a>
                    <a href="https://www.instagram.com/sark_boat_trips/" target="_blank" rel="noopener noreferrer" aria-label="Visit our Instagram profile">
                        <img width={'32px'} src={instaLogo} alt="Instagram" />
                    </a>
                    <a href='https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html' target="_blank" rel="noopener noreferrer" aria-label="Check our reviews on Tripadvisor">
                        <img width={'32px'} src={tripLogo} alt="Tripadvisor" />
                    </a>
                    <a href='https://g.co/kgs/RsJniax' target="_blank" rel="noopener noreferrer" aria-label="Find us on Google Maps">
                        <img width={'32px'} src={googleLogo} alt="Google" />
                    </a>
                </nav>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} Sark Boat Trips. All rights reserved.</p>
            </div>
        </footer>
    )
}

export default Footer