'use client'

// Синхронізує Sentry.setUser() з поточною admin-сесією — лише user.id
// (без PII), той самий принцип, що на публічному сайті (js/error-tracking.js).
// Без NEXT_PUBLIC_SENTRY_DSN Sentry.init() ніде не викликався — setUser()
// у такому разі просто no-op (SDK не ловить помилки без DSN).

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/client'

export default function SentryUserSync() {
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (uid) Sentry.setUser({ id: uid })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        Sentry.setUser({ id: session.user.id })
      }
      if (event === 'SIGNED_OUT') {
        Sentry.setUser(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  return null
}
