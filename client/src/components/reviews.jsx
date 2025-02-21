import React from 'react'
import '../css/reviews.css'

import googleLogo from '../assets/logos/7123025_logo_google_g_icon.png'
import tripLogo from '../assets/logos/4375113_logo_tripadvisor_icon.png'
import faceLogo from '../assets/logos/317746_facebook_social media_social_icon.png'

function Reviews() {
    return (
        <section id="reviews" className='reviews centered-section'>
            <h2>REVIEWS</h2>
            <div className='reviewsContainer'>
                <a href="https://g.co/kgs/xgNzzxD" target="_blank">
                    <div className='reviewCard'>
                        <img src={googleLogo} />
                        <div>
                            <p>Google</p>
                            <span>
                                <p>5.0</p>
                                <p className='gold'> ★★★★★</p>
                            </span>
                        </div>
                    </div>
                </a>
                <a href="https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html" target="_blank">
                    <div className='reviewCard'>
                        <img src={tripLogo} />
                        <div>
                            <p>Tripadvisor</p>
                            <span>
                                <p>5.0</p>
                                <p className='gold'> ★★★★★</p>
                            </span>
                        </div>
                    </div>
                </a>
                <a href="https://www.facebook.com/sarkboattrips/reviews" target="_blank">
                    <div className='reviewCard'>
                        <img src={faceLogo} />
                        <div>
                            <p>Facebook</p>
                            <span>
                                <p>5.0</p>
                                <p className='gold'> ★★★★★</p>
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        </section>
    )
}

export default Reviews

