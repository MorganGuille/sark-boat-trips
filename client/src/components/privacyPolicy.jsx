import React from 'react'

function PrivacyPolicy() {
    return (
        <article className='popUpDisplay' aria-labelledby="pp-title">
            <h2 id="pp-title">Privacy Policy for Sark Boat Trips</h2>

            <section>
                <p><strong>1. Introduction</strong></p>
                <p>Welcome to Sark Boat Trips. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and protect your data when you use our website (sarkboattrips.com) and our services.</p>
            </section>

            <section>
                <p><strong>2. Data Controller</strong></p>
                <p>Sark Boat Trips is the data controller responsible for your personal data. You can contact us at:</p>
                <address style={{ fontStyle: 'normal' }}>
                    <ul>
                        <li>Sark Boat Trips, Dixcart Ln, Sark, GY101SA, Guernsey</li>
                        <li><a href="tel:+447911764246">+44 7911 764 246</a></li>
                        <li><a href="mailto:sarkboattrips@gmail.com">sarkboattrips@gmail.com</a></li>
                    </ul>
                </address>
            </section>

            <section>
                <p><strong>3. Information We Collect</strong></p>
                <ul>
                    <li><strong>Contact Information:</strong> Name, email address, phone number, and any other information you provide when contacting us or making a booking.</li>
                    <li><strong>Booking Information:</strong> Details of your bookings, including dates, times, and requirements.</li>
                    <li><strong>Payment Data:</strong> For charter bookings, payments are processed securely by Stripe. We do not store your credit card information.</li>
                    <li><strong>Website Usage Data:</strong> IP addresses, browser type, and pages visited.</li>
                </ul>
            </section>

            <section>
                <p><strong>4. How We Use Your Information</strong></p>
                <ul>
                    <li>To process and manage your bookings.</li>
                    <li>To respond to inquiries and provide customer support.</li>
                    <li>To comply with Bailiwick of Guernsey legal obligations.</li>
                </ul>
            </section>

            <section>
                <p><strong>5. Data Sharing & Transfers</strong></p>
                <p>We share information with service providers (like Stripe for payments or hosting providers) only as necessary. Data may be processed outside the Bailiwick of Guernsey by these providers, subject to standard contractual protections.</p>
                <p>We will never sell or rent your personal information.</p>
            </section>

            <section>
                <p><strong>6. Data Retention</strong></p>
                <p>We will retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including legal, accounting, or reporting requirements.</p>
            </section>

            <section>
                <p><strong>7. Your Rights</strong></p>
                <p>Under the Data Protection (Bailiwick of Guernsey) Law, 2017, you have the right to access, rectify, or erase your data, and to object to or restrict its processing.</p>
                <p>You also have the **Right to Complain** to the Office of the Data Protection Authority (ODPA) in Guernsey if you are unhappy with how we handle your data.</p>
            </section>

            <section>
                <p><strong>8. Cookies</strong></p>
                <p>Our website may use cookies to enhance your experience. You can manage these via your browser settings.</p>
            </section>

            <section>
                <p><strong>9. Contact Us</strong></p>
                <p>For any privacy-related questions, please email us at <a href="mailto:sarkboattrips@gmail.com">sarkboattrips@gmail.com</a>.</p>
            </section>
        </article>
    )
}

export default PrivacyPolicy