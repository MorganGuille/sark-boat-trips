import PrivacyPolicy from '../components/privacyPolicy'

// The privacy policy on its own page, so Stripe's card page can link to it (sarkboattrips.com/privacy)
function PrivacyPage() {
    return (
        <>
            <title>Sark Boat Trips | Privacy Policy</title>
            <meta name="description" content="How Sark Boat Trips uses the details you give when you book: what we keep, why, how your card is saved by Stripe, and how to ask us to remove them." />
            <main id="main-content" className='termsPage'>
                <PrivacyPolicy className='termsArticle' />
            </main>
        </>
    )
}

export default PrivacyPage
