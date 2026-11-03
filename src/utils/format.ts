/** "820 KB", "4.2 MB". */
export function formatBytes (bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  // Number() drops a trailing ".0": "20 MB", "4.2 MB".
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}

/** "Nov 3, 2026" in the user's locale. */
export function formatDate (iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

/** "just now", "5 minutes ago", "yesterday"; older than four weeks: the date. */
export function formatRelative (iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const seconds = (date.getTime() - now.getTime()) / 1000
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24
  const weeks = days / 7
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (Math.abs(seconds) < 60) {
    return 'just now'
  }
  if (Math.abs(minutes) < 60) {
    return format.format(Math.round(minutes), 'minute')
  }
  if (Math.abs(hours) < 24) {
    return format.format(Math.round(hours), 'hour')
  }
  if (Math.abs(days) < 7) {
    return format.format(Math.round(days), 'day')
  }
  if (Math.abs(weeks) < 4) {
    return format.format(Math.round(weeks), 'week')
  }
  return formatDate(iso)
}

/** "1 page", "48 pages". */
export function plural (count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`
}
