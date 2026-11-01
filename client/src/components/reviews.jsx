import '../css/reviews.css'

import googleLogo from '../assets/logos/googleIcon.png'
import tripLogo from '../assets/logos/tripadvisorIcon.png'
import faceLogo from '../assets/logos/facebookIcon.png'

const SITES = [
    { name: 'Google', logo: googleLogo, href: 'https://g.co/kgs/xgNzzxD' },
    { name: 'Tripadvisor', logo: tripLogo, href: 'https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html' },
    { name: 'Facebook', logo: faceLogo, href: 'https://www.facebook.com/sarkboattrips/reviews' },
]

// One panel: the overall score at the top, then a row per review site (like a phone's settings list)
function Reviews() {
    return (
        <section id="reviews" className='reviews centered-section' aria-labelledby="reviews-heading">
            <h2 id="reviews-heading">REVIEWS</h2>

            <div className='reviewsPanel'>
                <div className='reviewsScore'>
                    <span className='reviewsNumber' aria-hidden="true">5.0</span>
                    <div>
                        <span className='gold reviewsStars' aria-hidden="true">★★★★★</span>
                        <span className='reviewsSummary'><span className='sr-only'>5.0 out of 5. </span>Rated 5 stars on every site</span>
                    </div>
                </div>

                <ul className='reviewsList'>
                    {SITES.map((site) => (
                        <li key={site.name}>
                            <a className='reviewRow' href={site.href} target="_blank" rel="noopener noreferrer" aria-label={`Read our reviews on ${site.name}, rated 5.0 out of 5`}>
                                <img src={site.logo} alt="" />
                                <span className='reviewSite'>{site.name}</span>
                                <span className='reviewScore'>5.0<span className='gold' aria-hidden="true">★★★★★</span></span>
                                <span className='reviewChevron' aria-hidden="true">›</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}

export default Reviews
