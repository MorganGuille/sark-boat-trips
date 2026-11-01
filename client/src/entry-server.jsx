import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { StaticRouter } from 'react-router' // No more /server!
import App from './App'

// The page at `url` as HTML, for prerender.js (spec P2-9: each public page is built to its own file)
export function render(url = '/') {
    const html = ReactDOMServer.renderToString(
        <React.StrictMode>
            <StaticRouter location={url}>
                <App />
            </StaticRouter>
        </React.StrictMode>
    )
    return html
}
