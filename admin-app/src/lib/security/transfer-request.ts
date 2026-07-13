export type TransferRequestFormat = 'form' | 'json' | 'unsupported'

export function getTransferRequestFormat(contentType: string | null): TransferRequestFormat {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()

  if (mediaType === 'application/x-www-form-urlencoded' || mediaType === 'multipart/form-data') {
    return 'form'
  }

  if (mediaType === 'application/json') {
    return 'json'
  }

  return 'unsupported'
}

export function isAllowedTransferOrigin({
  format,
  requestOrigin,
  mainSiteOrigin,
  adminOrigin,
}: {
  format: TransferRequestFormat
  requestOrigin: string | null
  mainSiteOrigin: string
  adminOrigin: string
}) {
  if (format === 'form') {
    return requestOrigin === mainSiteOrigin
  }

  if (format === 'json') {
    return requestOrigin === adminOrigin
  }

  return false
}
