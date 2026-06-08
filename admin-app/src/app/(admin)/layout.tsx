import Link from 'next/link'
import { ChefHat, ExternalLink } from 'lucide-react'
import AdminSidebarNav from '@/components/AdminSidebarNav'
import MobileNav from '@/components/MobileNav'
import LogoutButton from '@/components/LogoutButton'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen" style={{ background: '#f0f7f3' }}>
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

        <AdminSidebarNav />

        <div className="px-2 py-2" style={{ borderTop: '1px solid #82bf99' }}>
          <Link
            href={process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? '/'}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-colors hover:bg-black/10"
            style={{ color: '#0f2818' }}
          >
            <ExternalLink className="h-4 w-4 shrink-0" style={{ color: '#3f7558' }} />
            На сайт
          </Link>
          <LogoutButton />
        </div>
        <div className="px-4 py-2 text-xs" style={{ color: '#3f7558' }}>
          Minto Food © {new Date().getFullYear()}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      <MobileNav />
    </div>
  )
}
