import React from 'react'

function NotFound() {
    return (
        <div style={{ textAlign: 'center', padding: '50px', height: '90vh' }}>
            <h1>404 - Not Found</h1>
            <p>The page you are looking for does not exist.</p>
            <a className='btn' href='/'>Back to home</a>
        </div>
    )
}

export default NotFound