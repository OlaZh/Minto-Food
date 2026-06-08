export type TransferMessage = {
  type?: string
  accessToken?: string
  refreshToken?: string
}

type TransferValidationResult =
  | { status: 'ignore' }
  | { status: 'error'; message: string }
  | { status: 'accept'; accessToken: string; refreshToken: string }

export function validateTransferMessage({
  allowedOrigin,
  eventOrigin,
  data,
}: {
  allowedOrigin: string
  eventOrigin: string
  data: TransferMessage | null | undefined
}): TransferValidationResult {
  if (eventOrigin !== allowedOrigin) {
    return { status: 'ignore' }
  }

  if (data?.type !== 'MINTO_ADMIN_SESSION_TRANSFER') {
    return { status: 'ignore' }
  }

  const accessToken = data.accessToken
  const refreshToken = data.refreshToken

  if (!accessToken || !refreshToken) {
    return {
      status: 'error',
      message: 'Не вистачає токенів для входу в адмінку',
    }
  }

  return {
    status: 'accept',
    accessToken,
    refreshToken,
  }
}
