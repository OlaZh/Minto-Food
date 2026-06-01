'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TRANSFER_REQUEST = 'minto-admin-transfer-request'
const TRANSFER_SESSION = 'minto-admin-transfer-session'
const HANDOFF_TIMEOUT_MS = 12000

function getReferrerOrigin() {
  if (typeof document === 'undefined' || !document.referrer) return null

  try {
    return new URL(document.referrer).origin
  } catch {
    return null
  }
}

export default function AdminTransferPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Підключаємо безпечний вхід…')

  const fallbackOrigin = useMemo(() => {
    const envOrigin = process.env.NEXT_PUBLIC_MAIN_SITE_URL
    if (!envOrigin) return null

    try {
      return new URL(envOrigin).origin
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const timeoutRef: { current: number | undefined } = { current: undefined }
    let finished = false

    const supabase = createClient()
    const referrerOrigin = getReferrerOrigin()
    const allowedOrigin = referrerOrigin ?? fallbackOrigin

    const cleanup = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      window.removeEventListener('message', handleMessage)
    }

    const fail = (message: string) => {
      if (finished) return
      finished = true
      cleanup()
      setError(message)
      setStatus('Сесію не отримано')
    }

    const finishWithSession = async (accessToken: string, refreshToken: string) => {
      if (finished) return
      finished = true
      cleanup()
      setError(null)
      setStatus('Переносимо сесію в адмінку…')

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (sessionError) {
        setError(sessionError.message)
        setStatus('Не вдалося завершити вхід')
        return
      }

      window.history.replaceState({}, '', '/auth/transfer')
      router.replace('/dashboard')
    }

    const handleMessage = (event: MessageEvent) => {
      if (allowedOrigin && event.origin !== allowedOrigin) return
      if (event.data?.type !== TRANSFER_SESSION) return

      const accessToken = event.data?.payload?.accessToken
      const refreshToken = event.data?.payload?.refreshToken

      if (!accessToken || !refreshToken) {
        fail('Основний сайт не передав коректну сесію.')
        return
      }

      void finishWithSession(accessToken, refreshToken)
    }

    const legacyAccessToken = searchParams.get('access_token')
    const legacyRefreshToken = searchParams.get('refresh_token')
    if (legacyAccessToken && legacyRefreshToken) {
      void finishWithSession(legacyAccessToken, legacyRefreshToken)
      return cleanup
    }

    if (!window.opener) {
      fail('Відкрий адмінку через кнопку "Адмінка" на основному сайті.')
      return cleanup
    }

    window.addEventListener('message', handleMessage)
    timeoutRef.current = window.setTimeout(() => {
      fail('Час очікування сесії вичерпано. Спробуй ще раз з кнопки "Адмінка".')
    }, HANDOFF_TIMEOUT_MS)

    try {
      window.opener.postMessage({ type: TRANSFER_REQUEST }, allowedOrigin ?? '*')
    } catch {
      fail('Не вдалося зв’язатися з основним сайтом для передачі сесії.')
    }

    return cleanup
  }, [fallbackOrigin, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f9f4] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,40,24,.12)]">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e4f7eb] text-[#1d6f47]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h1 className="font-[Fraunces] text-2xl text-[#0f2818]">Minto Admin</h1>
        <p className="mt-2 text-sm text-[#3f7558]">{status}</p>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[#4ab584] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#39956d]"
          >
            Увійти через login
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600 transition-colors hover:border-gray-400"
          >
            На дашборд
          </Link>
        </div>
      </div>
    </div>
  )
}
