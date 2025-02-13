import React from 'react'
import '../css/reviews.css'

function Reviews() {
    return (
        <section className='reviews'>
            <h2>Reviews</h2>
            <div className='reviewsContainer'>
                <div className='reviewCard'>
                    <img src={'../src/assets/logos/7123025_logo_google_g_icon.png'} />
                    <div>
                        <p>Google</p>
                        <span>
                            <p>5.0</p>
                            <p className='gold'> ★★★★★</p>
                        </span>
                    </div>
                </div>
                <div className='reviewCard'>
                    <img src={'../src/assets/logos/4375113_logo_tripadvisor_icon.png'} />
                    <div>
                        <p>Tripadvisor</p>
                        <span>
                            <p>5.0</p>
                            <p className='gold'> ★★★★★</p>
                        </span>
                    </div>
                </div>
                <div className='reviewCard'>
                    <img src={'../src/assets/logos/317746_facebook_social media_social_icon.png'} />
                    <div>
                        <p>Facebook</p>
                        <span>
                            <p>5.0</p>
                            <p className='gold'> ★★★★★</p>
                        </span>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Reviews