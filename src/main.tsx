import { Auth0Provider } from '@auth0/auth0-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CallsProvider } from './context/CallsContext.tsx'

const AUTH0_DOMAIN = 'dev-rkgtbb0jgs831dap.us.auth0.com'
const AUTH0_CLIENT_ID = 'Hw0SLA4QIvKUCyyb2VDC8psjgpS1Tb5G'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <BrowserRouter>
        <CallsProvider>
          <App />
        </CallsProvider>
      </BrowserRouter>
    </Auth0Provider>
  </StrictMode>,
)