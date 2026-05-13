'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) alert(error.message)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f9f4',
      fontFamily: 'Mulish, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '48px 36px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 12px 48px rgba(15,40,24,.12)',
      }}>
        <div style={{ fontSize: '38px', marginBottom: '4px' }}>🌿</div>
        <p style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', color: '#0f2818', margin: '0 0 4px' }}>
          Minto Admin
        </p>
        <p style={{ fontSize: '13px', color: '#3f7558', margin: '0 0 28px' }}>
          Вхід тільки для адміністраторів
        </p>
        <button
          type="button"
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '13px',
            fontSize: '15px',
            fontWeight: '600',
            fontFamily: 'Mulish, sans-serif',
            background: '#4ab584',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
          }}
        >
          Увійти через Google
        </button>
      </div>
    </div>
  )
}
