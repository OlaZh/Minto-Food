'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  LayoutDashboard,
  Package,
  Shield,
  Users,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/recipes', label: 'Рецепти', icon: BookOpen },
  { href: '/reports', label: 'Скарги', icon: AlertTriangle },
  { href: '/moderation', label: 'Черга', icon: Shield },
  { href: '/users', label: 'Юзери', icon: Users },
  { href: '/products', label: 'Продукти', icon: Package },
]

export default function MobileNav() {
  const pathname = usePathname()
  const siteHref = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? '/'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 md:hidden border-t"
      style={{ background: '#9fd1b1', borderColor: '#82bf99' }}
    >
      <div className="flex overflow-x-auto px-2 py-2 gap-1.5 no-scrollbar">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className="min-w-[78px] flex flex-col items-center justify-center rounded-xl px-3 py-2 transition-colors"
              style={{
                color: isActive ? '#0f2818' : '#3f7558',
                background: isActive ? 'rgba(15,40,24,0.12)' : 'transparent',
              }}
            >
              <Icon className="h-4.5 w-4.5" />
              <span
                className="mt-1 text-[10px] font-medium whitespace-nowrap"
                style={{ fontFamily: 'Mulish, sans-serif', fontWeight: isActive ? 700 : 500 }}
              >
                {label}
              </span>
            </Link>
          )
        })}

        <Link
          href={siteHref}
          className="min-w-[78px] flex flex-col items-center justify-center rounded-xl px-3 py-2 transition-colors"
          style={{ color: '#3f7558' }}
        >
          <ExternalLink className="h-4.5 w-4.5" />
          <span
            className="mt-1 text-[10px] font-medium whitespace-nowrap"
            style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 500 }}
          >
            На сайт
          </span>
        </Link>
      </div>
    </nav>
  )
}
