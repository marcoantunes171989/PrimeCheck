import { createContext, useContext, useMemo, useState, type FormEvent, type PropsWithChildren } from 'react'
import '../auth.css'

const AUTH_SESSION_KEY = 'primecheck.auth.session.v1'
const ACCESS_REQUESTS_KEY = 'primecheck.auth.requests.v1'
const CURRENT_BUILD_SHA = String(
  import.meta.env.VITE_PRIMECHECK_SHA ??
  import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ??
  'runtime',
).trim()

export const PRIME_CHECK_ADMIN_USERNAME = 'administrador'
export const PRIME_CHECK_ADMIN_PASSWORD = 'admin@admin'

type AuthContextValue = {
  username: string
  logout: () => void
}

type AccessRequest = {
  id: string
  name: string
  email: string
  username: string
  notes: string
  requestedAt: string
  status: 'pending'
}

const AuthContext = createContext<AuthContextValue | null>(null)

const readSession = () => {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as {
      username?: string
      authenticated?: boolean
      buildSha?: string
    }

    const valid =
      parsed.authenticated === true &&
      parsed.username === PRIME_CHECK_ADMIN_USERNAME &&
      parsed.buildSha === CURRENT_BUILD_SHA

    if (!valid) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY)
      return ''
    }

    return parsed.username
  } catch {
    return ''
  }
}

const saveRequest = (request: AccessRequest) => {
  const current = (() => {
    try {
      const raw = window.localStorage.getItem(ACCESS_REQUESTS_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed as AccessRequest[] : []
    } catch {
      return [] as AccessRequest[]
    }
  })()

  const duplicate = current.some(item =>
    item.status === 'pending' &&
    (
      item.email.trim().toLowerCase() === request.email.trim().toLowerCase() ||
      item.username.trim().toLowerCase() === request.username.trim().toLowerCase()
    ),
  )

  if (duplicate) {
    throw new Error('Já existe uma solicitação pendente para este e-mail ou usuário.')
  }

  window.localStorage.setItem(
    ACCESS_REQUESTS_KEY,
    JSON.stringify([request, ...current].slice(0, 100)),
  )
}

export function usePrimeCheckAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('usePrimeCheckAuth deve ser utilizado dentro do PrimeCheckAuthGate.')
  return context
}

export default function PrimeCheckAuthGate({ children }: PropsWithChildren) {
  const [authenticatedUser, setAuthenticatedUser] = useState(readSession)
  const [mode, setMode] = useState<'login' | 'request'>('login')
  const [username, setUsername] = useState(PRIME_CHECK_ADMIN_USERNAME)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [requestName, setRequestName] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestUsername, setRequestUsername] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')

  const authContext = useMemo<AuthContextValue>(() => ({
    username: authenticatedUser,
    logout: () => {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY)
      setAuthenticatedUser('')
      setPassword('')
      setLoginError('')
      setMode('login')
    },
  }), [authenticatedUser])

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')

    const valid =
      username.trim().toLowerCase() === PRIME_CHECK_ADMIN_USERNAME &&
      password === PRIME_CHECK_ADMIN_PASSWORD

    if (!valid) {
      setLoginError('Usuário ou senha inválidos. Verifique as credenciais informadas.')
      return
    }

    window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      username: PRIME_CHECK_ADMIN_USERNAME,
      authenticated: true,
      buildSha: CURRENT_BUILD_SHA,
      authenticatedAt: new Date().toISOString(),
    }))
    setAuthenticatedUser(PRIME_CHECK_ADMIN_USERNAME)
  }

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestError('')
    setRequestMessage('')

    const name = requestName.trim()
    const email = requestEmail.trim()
    const desiredUsername = requestUsername.trim()

    if (!name || !email || !desiredUsername) {
      setRequestError('Preencha nome, e-mail e usuário desejado.')
      return
    }

    try {
      saveRequest({
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        email,
        username: desiredUsername,
        notes: requestNotes.trim(),
        requestedAt: new Date().toISOString(),
        status: 'pending',
      })

      setRequestName('')
      setRequestEmail('')
      setRequestUsername('')
      setRequestNotes('')
      setRequestMessage('Solicitação registrada. O acesso somente será liberado após inclusão do usuário no projeto.')
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Não foi possível registrar a solicitação.')
    }
  }

  if (authenticatedUser) {
    return (
      <AuthContext.Provider value={authContext}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <main className="primecheck-auth-page" data-primecheck-auth="required">
      <section className="primecheck-auth-shell" aria-label="Acesso ao PrimeCheck">
        <div className="primecheck-auth-brand">
          <div className="primecheck-auth-mark" aria-hidden="true">PC</div>
          <div>
            <span>PrimeCheck</span>
            <strong>Homologação de Dados</strong>
          </div>
        </div>

        <div className="primecheck-auth-copy">
          <span className="primecheck-auth-eyebrow">ACESSO RESTRITO</span>
          <h1>{mode === 'login' ? 'Acesse o projeto' : 'Solicite um novo cadastro'}</h1>
          <p>
            {mode === 'login'
              ? 'Entre com suas credenciais para acessar dashboards, importações, validações e análises do PrimeCheck.'
              : 'Envie seus dados para registrar uma solicitação de acesso. A solicitação não libera o projeto automaticamente.'}
          </p>
        </div>

        {mode === 'login' ? (
          <form className="primecheck-auth-form" onSubmit={submitLogin}>
            <label>
              <span>Usuário</span>
              <input
                type="text"
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
                spellCheck={false}
                autoFocus
                required
              />
            </label>

            <label>
              <span>Senha</span>
              <div className="primecheck-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>

            {loginError && <div className="primecheck-auth-alert error" role="alert">{loginError}</div>}

            <button type="submit" className="primecheck-auth-primary">
              Entrar no PrimeCheck
            </button>

            <div className="primecheck-auth-separator"><span>ou</span></div>

            <button
              type="button"
              className="primecheck-auth-secondary"
              onClick={() => {
                setMode('request')
                setLoginError('')
              }}
            >
              Solicitar novo cadastro
            </button>
          </form>
        ) : (
          <form className="primecheck-auth-form" onSubmit={submitRequest}>
            <div className="primecheck-request-grid">
              <label>
                <span>Nome completo</span>
                <input
                  type="text"
                  value={requestName}
                  onChange={event => setRequestName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={requestEmail}
                  onChange={event => setRequestEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <label>
              <span>Usuário desejado</span>
              <input
                type="text"
                value={requestUsername}
                onChange={event => setRequestUsername(event.target.value)}
                spellCheck={false}
                required
              />
            </label>

            <label>
              <span>Observação <small>opcional</small></span>
              <textarea
                value={requestNotes}
                onChange={event => setRequestNotes(event.target.value)}
                rows={3}
                placeholder="Informe setor, finalidade do acesso ou outra observação."
              />
            </label>

            {requestError && <div className="primecheck-auth-alert error" role="alert">{requestError}</div>}
            {requestMessage && <div className="primecheck-auth-alert success" role="status">{requestMessage}</div>}

            <button type="submit" className="primecheck-auth-primary">
              Registrar solicitação
            </button>
            <button
              type="button"
              className="primecheck-auth-secondary"
              onClick={() => {
                setMode('login')
                setRequestError('')
                setRequestMessage('')
              }}
            >
              Voltar ao login
            </button>
          </form>
        )}

        <footer className="primecheck-auth-footer">
          <span><i /> Processamento local</span>
          <small>O workspace permanece bloqueado até uma autenticação válida.</small>
        </footer>
      </section>
    </main>
  )
}
