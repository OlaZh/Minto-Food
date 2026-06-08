import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, Shield, Users, Package } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const sevenDaysAgoDate = new Date()
  sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7)
  const sevenDaysAgo = sevenDaysAgoDate.toISOString()

  const [reportsRes, pendingRecipesRes, activeUsersRes, userProductsRes] = await Promise.all([
    supabase.from('recipe_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
    supabase.rpc('admin_active_users_count', { p_since: sevenDaysAgo }),
    supabase.from('products').select('id', { count: 'exact', head: true }).not('user_id', 'is', null).is('deleted_at', null),
  ])

  const stats = [
    {
      label: 'Скарги',
      value: reportsRes.count ?? 0,
      href: '/reports',
      icon: AlertTriangle,
      alert: (reportsRes.count ?? 0) > 0,
    },
    {
      label: 'На модерації',
      value: pendingRecipesRes.count ?? 0,
      href: '/moderation',
      icon: Shield,
      alert: (pendingRecipesRes.count ?? 0) > 0,
    },
    {
      label: 'Активних (7д)',
      value: Number(activeUsersRes.data ?? 0),
      href: '/users',
      icon: Users,
      alert: false,
    },
    {
      label: 'Юзерські продукти',
      value: userProductsRes.count ?? 0,
      href: '/products',
      icon: Package,
      alert: false,
    },
  ]

  return (
    <div className="px-4 md:px-8 py-8">
      <h1 className="text-lg font-semibold mb-6">Дашборд</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map(({ label, value, href, icon: Icon, alert }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-4 p-5 rounded-xl border transition-colors hover:border-gray-300 ${
              alert ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className={`p-2.5 rounded-lg ${alert ? 'bg-orange-100' : 'bg-gray-100'}`}>
              <Icon className={`h-5 w-5 ${alert ? 'text-orange-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${alert ? 'text-orange-700' : 'text-gray-900'}`}>
                {value}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center">
        Дані в реальному часі
      </div>
    </div>
  )
}
