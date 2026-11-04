import type { Citation } from '@/types/api'

/** All quotes behind one [n] marker (a passage can be quoted several times, on several pages). */
export interface CitationGroup {
  number: number
  /** Sorted, without duplicates. */
  pages: number[]
  quotes: { page: number, quote: string }[]
}

/** A cited passage to show in the PDF viewer. */
export interface PdfTarget {
  page: number
  quotes: string[]
  /** The citation number, shown in the viewer. */
  number: number
}

export type AnswerPart
  = | { type: 'text', text: string }
    | { type: 'citation', group: CitationGroup }

export function groupCitations (citations: Citation[]): CitationGroup[] {
  const groups = new Map<number, CitationGroup>()
  for (const citation of citations) {
    const group = groups.get(citation.number) ?? { number: citation.number, pages: [], quotes: [] }
    group.quotes.push({ page: citation.page_number, quote: citation.quote })
    if (!group.pages.includes(citation.page_number)) {
      group.pages.push(citation.page_number)
    }
    groups.set(citation.number, group)
  }
  const sorted = [...groups.values()]
  sorted.sort((a, b) => a.number - b.number)
  for (const group of sorted) {
    group.pages.sort((a, b) => a - b)
  }
  return sorted
}

/**
 * Splits answer text into plain text and citation markers. Markers without a
 * matching citation stay as text. The answer is never interpreted as HTML.
 */
export function splitAnswer (content: string, groups: CitationGroup[]): AnswerPart[] {
  const byNumber = new Map(groups.map(group => [group.number, group]))
  const parts: AnswerPart[] = []
  let last = 0
  for (const match of content.matchAll(/\[(\d+)\]/g)) {
    const group = byNumber.get(Number(match[1]))
    if (!group) {
      continue
    }
    if (match.index > last) {
      parts.push({ type: 'text', text: content.slice(last, match.index) })
    }
    parts.push({ type: 'citation', group })
    last = match.index + match[0].length
  }
  if (last < content.length) {
    parts.push({ type: 'text', text: content.slice(last) })
  }
  return parts
}

/** "p. 14", "pp. 14–16", "pp. 3, 14". */
export function pagesLabel (pages: number[]): string {
  if (pages.length === 1) {
    return `p. ${pages[0]}`
  }
  const isRange = pages.every((page, index) => index === 0 || page === pages[index - 1]! + 1)
  return isRange ? `pp. ${pages[0]}–${pages.at(-1)}` : `pp. ${pages.join(', ')}`
}
