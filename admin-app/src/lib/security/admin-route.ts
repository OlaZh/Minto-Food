export type AdminRouteDecision = 'allow' | 'redirect-login' | 'redirect-unauthorized'

export function isPublicAdminPath(pathname: string) {
  return pathname === '/login' || pathname === '/unauthorized' || pathname.startsWith('/auth/')
}

export function getAdminRouteDecision({
  pathname,
  hasUser,
  isAdmin,
}: {
  pathname: string
  hasUser: boolean
  isAdmin: boolean
}): AdminRouteDecision {
  if (isPublicAdminPath(pathname)) {
    return 'allow'
  }

  if (!hasUser) {
    return 'redirect-login'
  }

  if (!isAdmin) {
    return 'redirect-unauthorized'
  }

  return 'allow'
}
