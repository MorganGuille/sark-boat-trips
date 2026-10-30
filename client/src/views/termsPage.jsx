import Terms from '../components/terms'

// The terms on their own page, so Stripe's card page can link to them (sarkboattrips.com/terms)
function TermsPage() {
    return (
        <>
            <title>Sark Boat Trips | Terms and Conditions</title>
            <main id="main-content" className='termsPage'>
                <Terms className='termsArticle' />
            </main>
        </>
    )
}

export default TermsPage
