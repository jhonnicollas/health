const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

/**
 * Format an ISO datetime string into Indonesian-readable format.
 * Example output: "17 Juni 2026 18:23:45"
 */
export function formatIndonesianDate(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '-'

  const day = date.getDate()
  const month = INDONESIAN_MONTHS[date.getMonth()]
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Format date only (without time) in Indonesian format.
 * Example output: "17 Juni 2026"
 */
export function formatIndonesianDateShort(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '-'

  const day = date.getDate()
  const month = INDONESIAN_MONTHS[date.getMonth()]
  const year = date.getFullYear()

  return `${day} ${month} ${year}`
}
