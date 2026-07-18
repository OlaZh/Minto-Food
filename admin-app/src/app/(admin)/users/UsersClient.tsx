'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import { addStrike, banUser, toggleAdmin, toggleShadowBan, unbanUser } from '@/app/actions/moderation'

type UserListItem = {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean
  is_banned: boolean
  is_shadow_banned: boolean
  strikes: number | null
  freeze_until: string | null
  created_at: string | null
  recipeCount: number
  lastActive: string | null
}

interface UsersClientProps {
  users: UserListItem[]
  page: number
  totalPages: number
  totalCount: number
  query: string
  searchError: string | null
}

export default function UsersClient({
  users,
  page,
  totalPages,
  totalCount,
  query,
  searchError,
}: UsersClientProps) {
  const router = useRouter()

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Користувачі</h1>
        <span className="text-sm text-gray-400">
          {query ? `${users.length} знайдено` : `${users.length} на сторінці`}
        </span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 space-y-2">
        <form method="get" action="/users" className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            key={query}
            type="search"
            name="q"
            placeholder="Пошук за ПІБ або email по всій базі…"
            defaultValue={query}
            maxLength={200}
            className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            Знайти
          </button>
          {query && (
            <Link
              href="/users"
              className="h-8 px-3 inline-flex items-center text-xs rounded-md border border-gray-200 hover:border-gray-400 transition-colors"
            >
              Очистити
            </Link>
          )}
        </form>
        <p className="text-xs text-gray-400">
          Пошук не залежить від сторінки та не враховує регістр.
        </p>
        {searchError && <p className="text-xs text-red-600">{searchError}</p>}
      </div>

      {totalCount > 0 && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {query
            ? `Знайдено ${totalCount} користувачів по всій базі${totalCount >= 100 ? ' · показано перші 100' : ''}`
            : `${totalCount} користувачів · сторінка ${page} з ${totalPages}`}
        </div>
      )}

      {users.length === 0 && !searchError && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          {query ? 'За цим ПІБ або email нікого не знайдено' : 'Нікого не знайдено'}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {users.map(user => {
          const isFrozen = Boolean(user.freeze_until && new Date(user.freeze_until) > new Date())
          const name = user.full_name || user.id.slice(0, 8)
          const strikeCount = user.strikes ?? 0

          return (
            <div
              key={user.id}
              className={`px-4 md:px-8 py-4 hover:bg-gray-50 ${user.is_banned ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{name}</span>
                    {user.is_admin && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                        ADMIN
                      </span>
                    )}
                    {user.is_banned && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                        BANNED
                      </span>
                    )}
                    {user.is_shadow_banned && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                        SHADOW
                      </span>
                    )}
                    {isFrozen && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                        FREEZE
                      </span>
                    )}
                    {strikeCount > 0 && (
                      <span className="text-xs text-orange-600 font-medium">
                        {'⚡'.repeat(Math.min(strikeCount, 3))} {strikeCount}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    {user.email && <span>{user.email}</span>}
                    <span>Рецептів: {user.recipeCount}</span>
                    <span suppressHydrationWarning>З {user.created_at?.slice(0, 10)}</span>
                    {user.lastActive && (
                      <span suppressHydrationWarning>Активний: {user.lastActive.slice(0, 10)}</span>
                    )}
                    {isFrozen && (
                      <span className="text-yellow-600">
                        Заморожений до {user.freeze_until?.slice(0, 10)}
                      </span>
                    )}
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
                  label={`⚡ Страйк (${strikeCount})`}
                  variant="outline"
                  useUndo
                  action={() => addStrike(user.id, strikeCount)}
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
                  label={user.is_admin ? '🔒 Зняти Admin' : '🔐 Admin'}
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

      {!query && totalPages > 1 && (
        <div className="px-4 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <Link
            href={`/users?page=${page - 1}`}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page <= 1
                ? 'pointer-events-none opacity-30 border-gray-200'
                : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={page <= 1}
          >
            ← Попередня
          </Link>

          <span className="text-xs text-gray-400">
            сторінка {page} з {totalPages}
          </span>

          <Link
            href={`/users?page=${page + 1}`}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page >= totalPages
                ? 'pointer-events-none opacity-30 border-gray-200'
                : 'border-gray-200 hover:border-gray-400'
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
