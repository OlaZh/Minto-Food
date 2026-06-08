'use client'

import { useEffect, useState } from 'react'

const MAIN_SITE_ORIGIN = process.env.NEXT_PUBLIC_MAIN_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_MAIN_SITE_URL).origin
  : null

type TransferMessage = {
  type?: string
  accessToken?: string
  refreshToken?: string
}

export default function TransferPage() {
  const configError = MAIN_SITE_ORIGIN ? null : 'Не налаштовано адресу основного сайту для secure transfer'
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!MAIN_SITE_ORIGIN) {
      return
    }

    const mainSiteOrigin = MAIN_SITE_ORIGIN

    async function handleMessage(event: MessageEvent<TransferMessage>) {
      if (event.origin !== mainSiteOrigin) return
      if (event.data?.type !== 'MINTO_ADMIN_SESSION_TRANSFER') return

      const accessToken = event.data.accessToken
      const refreshToken = event.data.refreshToken

      if (!accessToken || !refreshToken) {
        const message = 'Не вистачає токенів для входу в адмінку'
        setError(message)
        window.opener?.postMessage({ type: 'MINTO_ADMIN_SESSION_TRANSFER_ERROR', message }, mainSiteOrigin)
        return
      }

      try {
        const response = await fetch('/auth/transfer/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken }),
        })

        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(typeof result?.error === 'string' ? result.error : 'Не вдалося створити сесію')
        }

        window.opener?.postMessage({ type: 'MINTO_ADMIN_SESSION_TRANSFER_ACK' }, mainSiteOrigin)
        window.location.replace('/dashboard')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не вдалося передати сесію'
        setError(message)
        window.opener?.postMessage({ type: 'MINTO_ADMIN_SESSION_TRANSFER_ERROR', message }, mainSiteOrigin)
      }
    }

    window.addEventListener('message', handleMessage)
    window.opener?.postMessage({ type: 'MINTO_ADMIN_TRANSFER_READY' }, mainSiteOrigin)

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f9f4',
      fontFamily: 'Mulish, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '40px 32px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 12px 48px rgba(15,40,24,.12)',
      }}>
        <div style={{ fontSize: '38px', marginBottom: '8px' }}>🌿</div>
        <p style={{ fontFamily: 'Fraunces, serif', fontSize: '22px', color: '#0f2818', margin: '0 0 8px' }}>
          Minto Admin
        </p>
        {error ? (
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#b42318', margin: 0 }}>
            {error}
          </p>
        ) : configError ? (
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#b42318', margin: 0 }}>
            {configError}
          </p>
        ) : (
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#3f7558', margin: 0 }}>
            Переносимо безпечну сесію в адмінку. Це займає кілька секунд.
          </p>
        )}
      </div>
    </div>
  )
}
