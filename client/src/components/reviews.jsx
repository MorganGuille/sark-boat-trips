import React from 'react'
import '../css/reviews.css'

import googleLogo from '../assets/logos/googleIcon.png'
import tripLogo from '../assets/logos/tripadvisorIcon.png'
import faceLogo from '../assets/logos/facebookIcon.png'

function Reviews() {
    return (
        <section id="reviews" className='reviews centered-section'>
            <h2>REVIEWS</h2>
            <div className='reviewsContainer'>
                <a href="https://g.co/kgs/xgNzzxD" target="_blank">
                    <div className='reviewCard'>
                        <img src={googleLogo} alt="Google Logo" />
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
                        <img src={tripLogo} alt="Tripadvisor Logo" />
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
                        <img src={faceLogo} alt="Facebook Logo" />
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

