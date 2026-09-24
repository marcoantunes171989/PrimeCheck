import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './responsive.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const localValidation = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

  window.addEventListener('load', () => {
    if (localValidation) {
      void navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
        .catch(() => undefined)

      if ('caches' in window) {
        void caches.keys()
          .then(keys => Promise.all(keys.map(key => caches.delete(key))))
          .catch(() => undefined)
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
