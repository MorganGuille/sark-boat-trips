import React from 'react'
import { useState } from 'react'
import '../css/footer.css'

import PrivacyPolicy from './privacyPolicy'
import Terms from './terms'

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
        </footer>

    </>)
}

export default Footer