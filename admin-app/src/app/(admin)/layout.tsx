import Link from 'next/link';
import {
  BookOpen,
  Users,
  Tag,
  LayoutDashboard,
  ChefHat,
  AlertTriangle,
  Shield,
  Package,
  Archive,
  UserCheck,
} from 'lucide-react';
import MobileNav from '@/components/MobileNav';

const editorialNav = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/recipes', label: 'Рецепти', icon: BookOpen },
  { href: '/authors', label: 'Автори', icon: UserCheck },
  { href: '/tags', label: 'Теги', icon: Tag },
];

const moderationNav = [
  { href: '/reports', label: 'Скарги', icon: AlertTriangle },
  { href: '/moderation', label: 'Модерація', icon: Shield },
  { href: '/users', label: 'Юзери', icon: Users },
  { href: '/products', label: 'Продукти', icon: Package },
  { href: '/archive', label: 'Архів', icon: Archive },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen" style={{ background: '#f0f7f3' }}>
      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-56 flex-col shrink-0"
        style={{ background: '#9fd1b1', borderRight: '1px solid #82bf99' }}
      >
        <div
          className="h-14 flex items-center gap-2 px-4"
          style={{ borderBottom: '1px solid #82bf99', background: '#4ab584' }}
        >
          <ChefHat className="h-5 w-5" style={{ color: '#0f2818' }} />
          <span
            className="font-semibold text-sm"
            style={{ color: '#0f2818', fontFamily: 'Rubik, sans-serif' }}
          >
            Minto Admin
          </span>
          <span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'rgba(15,40,24,0.15)', color: '#0f2818' }}
          >
            Admin
          </span>
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <p
            className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: '#3f7558' }}
          >
            Редакція
          </p>
          <div className="space-y-0.5 mb-4">
            {editorialNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="admin-nav-link flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
                style={{ color: '#0f2818' }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: '#3f7558' }} />
                {label}
              </Link>
            ))}
          </div>
          <p
            className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: '#3f7558' }}
          >
            Модерація
          </p>
          <div className="space-y-0.5">
            {moderationNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="admin-nav-link flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
                style={{ color: '#0f2818' }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: '#3f7558' }} />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        <div
          className="px-4 py-3 text-xs"
          style={{ borderTop: '1px solid #82bf99', color: '#3f7558' }}
        >
          Minto Food © {new Date().getFullYear()}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <MobileNav />
    </div>
  );
}
