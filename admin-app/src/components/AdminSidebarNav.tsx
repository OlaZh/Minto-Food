'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, CSSProperties } from 'react'
import {
  Archive,
  AlertTriangle,
  BookOpen,
  Database,
  HelpCircle,
  LayoutDashboard,
  Package,
  ScanBarcode,
  SlidersHorizontal,
  Shield,
  Tag,
  UserCheck,
  Users,
} from 'lucide-react'

const editorialNav = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/recipes', label: 'Рецепти', icon: BookOpen },
  { href: '/authors', label: 'Автори', icon: UserCheck },
  { href: '/tags', label: 'Теги', icon: Tag },
]

const moderationNav = [
  { href: '/reports', label: 'Скарги', icon: AlertTriangle },
  { href: '/moderation', label: 'Модерація', icon: Shield },
  { href: '/users', label: 'Юзери', icon: Users },
  { href: '/products', label: 'Продукти', icon: Package },
  { href: '/catalog', label: 'Каталог', icon: Database },
  { href: '/feature-flags', label: 'Функції', icon: SlidersHorizontal },
  { href: '/corrections', label: 'Правки ШК', icon: ScanBarcode },
  { href: '/unmatched', label: 'Нерозпізнані', icon: HelpCircle },
  { href: '/archive', label: 'Архів', icon: Archive },
]

function NavSection({
  title,
  items,
}: {
  title: string
  items: { href: string; label: string; icon: ComponentType<{ className?: string; style?: CSSProperties }> }[]
}) {
  const pathname = usePathname()

  return (
    <>
      <p
        className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: '#3f7558' }}
      >
        {title}
      </p>
      <div className="space-y-0.5 mb-4">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)

          return (
            <Link
              key={href}
              href={href}
              className="admin-nav-link flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                color: '#0f2818',
                background: isActive ? 'rgba(15,40,24,0.12)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: isActive ? '#0f2818' : '#3f7558' }}
              />
              {label}
            </Link>
          )
        })}
      </div>
    </>
  )
}

export default function AdminSidebarNav() {
  return (
    <nav className="flex-1 px-2 py-3 overflow-y-auto">
      <NavSection title="Редакція" items={editorialNav} />
      <NavSection title="Модерація" items={moderationNav} />
    </nav>
  )
}
