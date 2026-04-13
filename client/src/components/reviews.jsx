import React from 'react'
import '../css/reviews.css'

import googleLogo from '../assets/logos/googleIcon.png'
import tripLogo from '../assets/logos/tripadvisorIcon.png'
import faceLogo from '../assets/logos/facebookIcon.png'

function Reviews() {
    return (
        /* 1. REGION LANDMARK: Labeling the section so it appears in landmark menus */
        <section id="reviews" className='reviews centered-section' aria-labelledby="reviews-heading">
            <h2 id="reviews-heading">REVIEWS</h2>

            <div className='reviewsContainer'>
                {/* 2. DESCRIPTIVE LINKS: Adding aria-labels so users know exactly where the link goes */}

                <a href="https://g.co/kgs/xgNzzxD" target="_blank" rel="noopener noreferrer" aria-label="Read our reviews on Google">
                    <div className='reviewCard'>
                        <img src={googleLogo} alt="Google" />
                        <div>
                            <p>Google</p>
                            {/* 3. ACCESSIBLE RATINGS: Hide the visual stars from screen readers 
                                  and provide a clear text alternative */}
                            <span aria-label="5.0 out of 5 stars">
                                <p aria-hidden="true">5.0</p>
                                <p className='gold' aria-hidden="true"> ★★★★★</p>
                            </span>
                        </div>
                    </div>
                </a>

                <a href="https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html" target="_blank" rel="noopener noreferrer" aria-label="Read our reviews on Tripadvisor">
                    <div className='reviewCard'>
                        <img src={tripLogo} alt="Tripadvisor" />
                        <div>
                            <p>Tripadvisor</p>
                            <span aria-label="5.0 out of 5 stars">
                                <p aria-hidden="true">5.0</p>
                                <p className='gold' aria-hidden="true"> ★★★★★</p>
                            </span>
                        </div>
                    </div>
                </a>

                <a href="https://www.facebook.com/sarkboattrips/reviews" target="_blank" rel="noopener noreferrer" aria-label="Read our reviews on Facebook">
                    <div className='reviewCard'>
                        <img src={faceLogo} alt="Facebook" />
                        <div>
                            <p>Facebook</p>
                            <span aria-label="5.0 out of 5 stars">
                                <p aria-hidden="true">5.0</p>
                                <p className='gold' aria-hidden="true"> ★★★★★</p>
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        </section>
    )
}

export default Reviews