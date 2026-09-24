import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './responsive.css'

type RuntimeBoundaryState = {
  error: Error | null
}

class PrimeCheckRuntimeBoundary extends React.Component<React.PropsWithChildren, RuntimeBoundaryState> {
  state: RuntimeBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RuntimeBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PrimeCheck runtime error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#012E46' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>PrimeCheck não conseguiu iniciar</h1>
        <p style={{ maxWidth: 780 }}>
          Foi identificado um erro de execução no frontend. Copie a mensagem abaixo para análise.
        </p>
        <pre style={{ padding: 16, overflow: 'auto', borderRadius: 10, background: '#f4f7f9', whiteSpace: 'pre-wrap' }}>
          {this.state.error.message || String(this.state.error)}
        </pre>
      </main>
    )
  }
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento raiz #root não encontrado.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PrimeCheckRuntimeBoundary>
      <App />
    </PrimeCheckRuntimeBoundary>
  </React.StrictMode>,
)

document.documentElement.setAttribute('data-primecheck-runtime', 'mounted')

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
