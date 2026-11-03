import '../css/reviews.css'

import googleLogo from '../assets/logos/googleIcon.png'
import tripLogo from '../assets/logos/tripadvisorIcon.png'
import faceLogo from '../assets/logos/facebookIcon.png'

const SITES = [
    { name: 'Google', logo: googleLogo, href: 'https://g.co/kgs/xgNzzxD' },
    { name: 'Tripadvisor', logo: tripLogo, href: 'https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html' },
    { name: 'Facebook', logo: faceLogo, href: 'https://www.facebook.com/sarkboattrips/reviews' },
]

// Quotes the owner chose (2 Nov 2026), trimmed a little, with first name and initial only
const QUOTES = [
    {
        text: 'A fantastic boat tour around the entire island of Sark. We learnt so much from our excellent skipper, Morgan, and would highly recommend this boat trip to anyone visiting Sark.',
        name: 'Richard W.',
        site: 'Google',
    },
    {
        text: 'The whole trip was amazing, very informative and so enhanced by the enthusiasm of Morgan and George. Wonderful caves, rock formations and a variety of seabirds including puffins. Completely exceeded our expectations.',
        name: 'Sandra B.',
        site: 'Tripadvisor',
    },
    {
        text: "Fabulous tour to see Sark from the sea and explore the caves. Excellent way to see the guillemot colonies at Les Autelets and Les Burons and the puffin colony at L'Etac. Morgan and George skilfully guide the boat into caves and between the rocks.",
        name: 'Lynda H.',
        site: 'Facebook',
    },
]

// Straight after the tour (owner, 2 Nov 2026): the score, three quotes (side by side on a laptop, swiped
// on a phone), then a link per review site
function Reviews() {
    return (
        <section id="reviews" className='reviews' aria-labelledby="reviews-heading">
            <p className='eyebrow'>Reviews</p>
            <h2 id="reviews-heading">Rated 5 stars</h2>

            <ul className='reviewQuotes' aria-label='What people say' tabIndex={0}>
                {QUOTES.map((quote) => (
                    <li key={quote.name}>
                        <figure>
                            <span className='gold reviewStars' role='img' aria-label='5 stars'>★★★★★</span>
                            <blockquote><p>&ldquo;{quote.text}&rdquo;</p></blockquote>
                            <figcaption>{quote.name}, {quote.site}</figcaption>
                        </figure>
                    </li>
                ))}
            </ul>

            <ul className='reviewsList'>
                {SITES.map((site) => (
                    <li key={site.name}>
                        <a className='reviewRow' href={site.href} target="_blank" rel="noopener noreferrer" aria-label={`Read our reviews on ${site.name}, rated 5.0 out of 5`}>
                            <img src={site.logo} alt="" width='22' height='22' />
                            <span className='reviewSite'>{site.name}</span>
                            <span className='reviewScore'>5.0<span className='gold' aria-hidden="true">★</span></span>
                            <span className='reviewChevron' aria-hidden="true">›</span>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    )
}

export default Reviews
