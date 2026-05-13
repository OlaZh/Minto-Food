'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, AlertTriangle, Shield, Users } from 'lucide-react'

const nav = [
  { href: '/dashboard',  label: 'Дашборд',  icon: LayoutDashboard },
  { href: '/recipes',    label: 'Рецепти',   icon: BookOpen },
  { href: '/reports',    label: 'Скарги',    icon: AlertTriangle },
  { href: '/moderation', label: 'Черга',     icon: Shield },
  { href: '/users',      label: 'Юзери',     icon: Users },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex md:hidden"
      style={{ background: '#9fd1b1', borderTop: '1px solid #82bf99' }}
    >
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
            style={{ color: active ? '#0f2818' : '#3f7558' }}
          >
            <Icon className="h-5 w-5" />
            <span
              className="text-[10px] font-medium"
              style={{ fontFamily: 'Mulish, sans-serif', fontWeight: active ? 600 : 400 }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
