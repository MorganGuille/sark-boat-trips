import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { StaticRouter } from 'react-router' // No more /server!
import App from './App'

export function render() {
    const html = ReactDOMServer.renderToString(
        <React.StrictMode>
            <StaticRouter location="/">
                <App />
            </StaticRouter>
        </React.StrictMode>
    )
    return html
}