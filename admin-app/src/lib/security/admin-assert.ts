export function getAssertAdminErrorMessage({
  sessionErrorMessage,
  hasUser,
  profileErrorMessage,
  isAdmin,
}: {
  sessionErrorMessage?: string | null
  hasUser: boolean
  profileErrorMessage?: string | null
  isAdmin: boolean
}) {
  if (sessionErrorMessage) {
    return `Не вдалося отримати сесію: ${sessionErrorMessage}`
  }

  if (!hasUser) {
    return 'Потрібно увійти як адміністратор'
  }

  if (profileErrorMessage) {
    return `Не вдалося перевірити права адміністратора: ${profileErrorMessage}`
  }

  if (!isAdmin) {
    return 'Дію дозволено лише адміністраторам'
  }

  return null
}
