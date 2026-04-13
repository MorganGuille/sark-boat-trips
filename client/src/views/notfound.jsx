import React from 'react'
import { Link } from 'react-router' // Use Link for internal SPA routing

function NotFound() {
    return (
        <>
            <title>Sark Boat Trips | 404 Page Not Found</title>

            <main id="main-content" style={{ textAlign: 'center', padding: '100px 20px', minHeight: '80vh' }}>

                <div role="status">
                    <h1 style={{ fontSize: '3rem' }}>404 - Adrift!</h1>
                </div>

                <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
                    It looks like you've gone off course. The page you are looking for has been washed away or doesn't exist.
                </p>

                <Link className='btn' to='/' aria-label="Return to the Sark Boat Trips home page">
                    Back to safe harbour (Home)
                </Link>

            </main>
        </>
    )
}

export default NotFound