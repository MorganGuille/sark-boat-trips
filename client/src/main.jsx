import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router' // Standard for v7
import App from './App'
import './App.css'

const container = document.getElementById('root');

// 1. Check if the server already injected HTML (Production/Heroku)
if (container.innerHTML.trim().length > 0) {
  hydrateRoot(
    container,
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
} 
// 2. Otherwise, do a fresh render (Development/Local)
else {
  createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
}