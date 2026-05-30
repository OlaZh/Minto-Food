'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-colors hover:bg-black/10"
      style={{ color: '#0f2818' }}
    >
      <LogOut className="h-4 w-4 shrink-0" style={{ color: '#3f7558' }} />
      Вийти
    </button>
  )
}
