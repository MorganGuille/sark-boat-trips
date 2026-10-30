import PrivacyPolicy from '../components/privacyPolicy'

// The privacy policy on its own page, so Stripe's card page can link to it (sarkboattrips.com/privacy)
function PrivacyPage() {
    return (
        <>
            <title>Sark Boat Trips | Privacy Policy</title>
            <main id="main-content" className='termsPage'>
                <PrivacyPolicy className='termsArticle' />
            </main>
        </>
    )
}

export default PrivacyPage
