export function downloadCsv(filename: string, rows: Record<string, unknown>[], headers?: string[]) {
  if (!rows.length) return
  const cols = headers ?? Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach(k => set.add(k))
    return set
  }, new Set()))
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    cols.join(','),
    ...rows.map(r => cols.map(c => escape(r[c])).join(','))
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
