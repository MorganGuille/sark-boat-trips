import React from 'react'
import { useState } from 'react'
import '../css/footer.css'

import PrivacyPolicy from './privacyPolicy'
import Terms from './terms'

import googleLogo from '../assets/logos/7123025_logo_google_g_icon.png'
import tripLogo from '../assets/logos/4375113_logo_tripadvisor_icon.png'
import faceLogo from '../assets/logos/317746_facebook_social media_social_icon.png'
import instaLogo from '../assets/logos/4102579_applications_instagram_media_social_icon.png'



function Footer() {

    const [showPrivacyP, setshowPrivacyP] = useState(null)
    const [showTerms, setshowTerms] = useState(null)

    return (<>

        {showPrivacyP ? <><div onClick={() => setshowPrivacyP(false)} className="popUpBackground"></div>
            <PrivacyPolicy /></>
            : null}

        {showTerms ? <><div onClick={() => setshowTerms(false)} className="popUpBackground"></div>
            <Terms /></>
            : null}


        <footer>
            <div className="footer-section">
                <a href="https://maps.app.goo.gl/E2XLJqrGku7eDePZ8" target='_blank'>Sark Boat Trips, Dixcart Ln, Sark, GY10, Guernsey</a>
                <a href="tel:+44-7911-764-246">+447911764246</a>
                <a href="mailto:sarkboattrips@gmail.com">sarkboattrips@gmail.com</a>
            </div>
            <div className="footer-section">
                <a onClick={() => setshowPrivacyP(!showPrivacyP)}>Privacy Policy</a>
                <a onClick={() => setshowTerms(!showTerms)}>Terms and Conditions</a>
            </div>
            <fieldset className='footer-links'>
                <legend>Social links</legend>
                <a href="https://www.facebook.com/sarkboattrips" target="_blank"><img width={'32px'} src={faceLogo} /></a>
                <a href="https://www.instagram.com/sark_boat_trips/" target="_blank"><img width={'32px'} src={instaLogo} /></a>
                <a href='https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html' target="_blank"><img width={'32px'} src={tripLogo} /></a>
                <a href='https://g.co/kgs/RsJniax' target="_blank"><img width={'32px'} src={googleLogo} /></a>
            </fieldset>
        </footer>

    </>)
}

export default Footer