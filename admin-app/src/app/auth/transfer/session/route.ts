import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getTransferRequestFormat,
  isAllowedTransferOrigin,
} from '@/lib/security/transfer-request'

function getMainSiteOrigin() {
  const mainSiteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL
  if (!mainSiteUrl) return null

  try {
    return new URL(mainSiteUrl).origin
  } catch {
    return null
  }
}

function transferError(request: NextRequest, format: 'form' | 'json', message: string, status: number) {
  if (format === 'form') {
    return NextResponse.redirect(new URL('/login', request.url), 303)
  }

  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  const format = getTransferRequestFormat(request.headers.get('content-type'))
  if (format === 'unsupported') {
    return NextResponse.json({ error: 'Непідтримуваний формат запиту' }, { status: 415 })
  }

  const mainSiteOrigin = getMainSiteOrigin()
  if (!mainSiteOrigin) {
    return transferError(request, format, 'Не налаштовано адресу основного сайту', 500)
  }

  const originAllowed = isAllowedTransferOrigin({
    format,
    requestOrigin: request.headers.get('origin'),
    mainSiteOrigin,
    adminOrigin: request.nextUrl.origin,
  })

  if (!originAllowed) {
    return transferError(request, format, 'Недозволене джерело запиту', 403)
  }

  const body = format === 'form'
    ? Object.fromEntries(await request.formData())
    : await request.json().catch(() => null)
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : null
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : null

  if (!accessToken || !refreshToken) {
    return transferError(request, format, 'Потрібні access та refresh token', 400)
  }

  const response = format === 'form'
    ? NextResponse.redirect(new URL('/dashboard', request.url), 303)
    : NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    return transferError(request, format, error.message, 400)
  }

  return response
}
