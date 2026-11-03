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

/** "1 page", "48 pages". */
export function plural (count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`
}
