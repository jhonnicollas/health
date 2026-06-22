const INDONESIAN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

function parseIso(iso: string): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return date
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * @deprecated Use formatDateTimeIDFull instead.
 * Indonesian full-month format: "17 Juni 2026 18:23:45"
 */
export function formatIndonesianDate(isoString: string | null | undefined): string {
  const date = parseIso(isoString ?? '')
  if (!date) return '-'
  const day = date.getDate()
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const year = date.getFullYear()
  return `${day} ${monthNames[date.getMonth()]} ${year} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * @deprecated Use formatDateID instead.
 * Short full-month date: "17 Juni 2026"
 */
export function formatIndonesianDateShort(isoString: string | null | undefined): string {
  const date = parseIso(isoString ?? '')
  if (!date) return '-'
  const day = date.getDate()
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`
}

/** Date only, short Indonesian month: "23 Jun 2026" */
export function formatDateID(iso: string | null | undefined): string {
  const date = parseIso(iso ?? '')
  if (!date) return '-'
  return `${date.getDate()} ${INDONESIAN_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`
}

/** Date + time (HH:mm), short Indonesian month: "23 Jun 2026 18:30" */
export function formatDateTimeID(iso: string | null | undefined): string {
  const date = parseIso(iso ?? '')
  if (!date) return '-'
  return `${date.getDate()} ${INDONESIAN_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Date + time (HH:mm:ss), short Indonesian month: "23 Jun 2026 18:30:45" */
export function formatDateTimeIDFull(iso: string | null | undefined): string {
  const date = parseIso(iso ?? '')
  if (!date) return '-'
  return `${date.getDate()} ${INDONESIAN_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Date + time split for stacking: { date: "23 Jun 2026", time: "18:30" } */
export function formatDateTimeShort(iso: string | null | undefined): { date: string; time: string } {
  const date = parseIso(iso ?? '')
  if (!date) return { date: '-', time: '-' }
  return {
    date: `${date.getDate()} ${INDONESIAN_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}
