'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import { banUser, unbanUser, addStrike, toggleShadowBan, toggleAdmin } from '@/app/actions/moderation'

interface UserRow {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean
  is_banned: boolean
  is_shadow_banned: boolean
  strikes: number
  freeze_until: string | null
  created_at: string
  recipe_count: number
  last_active: string | null
  total_count: number
}

interface UsersClientProps {
  users: UserRow[]
  errorMessage: string | null
  searchQuery: string
  page: number
  pageSize: number
  totalCount: number
  currentUserId: string | null
  adminCount: number
}

function buildUsersHref(searchQuery: string, page: number) {
  const params = new URLSearchParams()
  if (searchQuery) params.set('q', searchQuery)
  params.set('page', String(page))
  return `/users?${params.toString()}`
}

export default function UsersClient({
  users,
  errorMessage,
  searchQuery,
  page,
  pageSize,
  totalCount,
  currentUserId,
  adminCount,
}: UsersClientProps) {
  const router = useRouter()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Користувачі</h1>
        <span className="text-sm text-gray-400">{totalCount} записів</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100">
        <form className="flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Пошук за email, іменем або ID…"
            className="w-full max-w-md text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            className="h-9 px-3 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            Знайти
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="px-4 md:px-8 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {errorMessage}
        </div>
      )}

      {totalCount > 0 && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {from}–{to} з {totalCount}
        </div>
      )}

      {users.length === 0 && !errorMessage && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Нікого не знайдено</div>
      )}

      <div className="divide-y divide-gray-100">
        {users.map(user => {
          const isFrozen = !!user.freeze_until && new Date(user.freeze_until) > new Date()
          const name = user.full_name || user.email || user.id.slice(0, 8)
          const isSelfAdmin = user.is_admin && user.id === currentUserId
          const isLastAdmin = user.is_admin && adminCount <= 1
          const adminToggleDisabled = isSelfAdmin || isLastAdmin
          const adminToggleTitle = isSelfAdmin
            ? 'Не можна зняти адмін-права з власного акаунта'
            : isLastAdmin
              ? 'Не можна зняти права з останнього адміна'
              : undefined

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
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    {user.email && <span>{user.email}</span>}
                    <span>Рецептів: {user.recipe_count ?? 0}</span>
                    <span suppressHydrationWarning>З {user.created_at?.slice(0, 10)}</span>
                    {user.last_active && <span suppressHydrationWarning>Активний: {user.last_active.slice(0, 10)}</span>}
                    {isFrozen && <span className="text-yellow-600">Заморожений до {user.freeze_until?.slice(0, 10)}</span>}
                  </div>
                  {adminToggleDisabled && (
                    <p className="mt-1 text-xs text-gray-400">{adminToggleTitle}</p>
                  )}
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
                  disabled={adminToggleDisabled}
                  title={adminToggleTitle}
                />
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="px-4 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <Link
            href={buildUsersHref(searchQuery, Math.max(1, page - 1))}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page <= 1 ? 'pointer-events-none opacity-30 border-gray-200' : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={page <= 1}
          >
            ← Попередня
          </Link>

          <span className="text-xs text-gray-400">
            сторінка {page} з {totalPages}
          </span>

          <Link
            href={buildUsersHref(searchQuery, Math.min(totalPages, page + 1))}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page >= totalPages ? 'pointer-events-none opacity-30 border-gray-200' : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={page >= totalPages}
          >
            Наступна →
          </Link>
        </div>
      )}
    </div>
  )
}
