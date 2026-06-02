'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import { banUser, unbanUser, addStrike, toggleShadowBan, toggleAdmin } from '@/app/actions/moderation'

interface UsersClientProps {
  users: any[]
}

export default function UsersClient({ users }: UsersClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = search
    ? users.filter(u => (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Користувачі</h1>
        <span className="text-sm text-gray-400">{filtered.length} записів</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Пошук за іменем…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Нікого не знайдено</div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map(user => {
          const isFrozen = user.freeze_until && new Date(user.freeze_until) > new Date()
          const name = user.full_name || user.id.slice(0, 8)

          return (
            <div key={user.id} className={`px-4 md:px-8 py-4 hover:bg-gray-50 ${user.is_banned ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{name}</span>
                    {user.is_admin && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                    )}
                    {user.is_banned && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">BANNED</span>
                    )}
                    {user.is_shadow_banned && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">SHADOW</span>
                    )}
                    {isFrozen && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">FREEZE</span>
                    )}
                    {(user.strikes ?? 0) > 0 && (
                      <span className="text-xs text-orange-600 font-medium">{'⚡'.repeat(Math.min(user.strikes, 3))} {user.strikes}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    <span>Рецептів: {user.recipeCount}</span>
                    <span suppressHydrationWarning>З {user.created_at?.slice(0, 10)}</span>
                    {user.lastActive && <span suppressHydrationWarning>Активний: {user.lastActive?.slice(0, 10)}</span>}
                    {isFrozen && <span className="text-yellow-600">Заморожений до {user.freeze_until?.slice(0, 10)}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {user.is_banned ? (
                  <ActionButton
                    label="Розбан"
                    confirmText="Розблокувати?"
                    variant="outline"
                    action={() => unbanUser(user.id)}
                    onDone={() => router.refresh()}
                  />
                ) : (
                  <ActionButton
                    label="Бан"
                    variant="destructive"
                    useUndo
                    action={() => banUser(user.id)}
                    onDone={() => router.refresh()}
                  />
                )}
                <ActionButton
                  label={`⚡ Страйк (${user.strikes ?? 0})`}
                  variant="outline"
                  useUndo
                  action={() => addStrike(user.id, user.strikes ?? 0)}
                  onDone={() => router.refresh()}
                />
                <ActionButton
                  label={user.is_shadow_banned ? '👁 Зняти тінь' : '👁 Shadow'}
                  confirmText={user.is_shadow_banned ? 'Зняти shadow ban?' : 'Shadow ban?'}
                  variant="outline"
                  action={() => toggleShadowBan(user.id, user.is_shadow_banned)}
                  onDone={() => router.refresh()}
                />
                <ActionButton
                  label={user.is_admin ? '🔓 Зняти Admin' : '🔐 Admin'}
                  confirmText={user.is_admin ? 'Зняти права адміна?' : 'Надати права адміна?'}
                  variant="outline"
                  action={() => toggleAdmin(user.id, user.is_admin)}
                  onDone={() => router.refresh()}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
