import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminRouteDecision, isPublicAdminPath } from '@/lib/security/admin-route'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isPublicAdminPath(pathname)) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const unauthenticatedDecision = getAdminRouteDecision({
    pathname,
    hasUser: Boolean(user),
    isAdmin: false,
  })

  if (unauthenticatedDecision === 'redirect-login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user!.id)
    .single()

  const routeDecision = getAdminRouteDecision({
    pathname,
    hasUser: true,
    isAdmin: Boolean(profile?.is_admin),
  })

  if (routeDecision === 'redirect-unauthorized') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
