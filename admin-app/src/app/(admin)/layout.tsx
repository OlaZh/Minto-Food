import Link from 'next/link'
import { BookOpen, Users, Tag, LayoutDashboard, ChefHat } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/recipes', label: 'Рецепти', icon: BookOpen },
  { href: '/authors', label: 'Автори', icon: Users },
  { href: '/tags', label: 'Теги', icon: Tag },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-200">
          <ChefHat className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-sm">Minto Admin</span>
          <span className="ml-auto text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
            Admin
          </span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Icon className="h-4 w-4 text-gray-400 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400">
          Minto Food © {new Date().getFullYear()}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
