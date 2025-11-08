import { useAuth0 } from '@auth0/auth0-react'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        Authenticating...
      </div>
    )
  }
  if (!isAuthenticated) {
    loginWithRedirect()
    return null
  }
  return <>{children}</>
}