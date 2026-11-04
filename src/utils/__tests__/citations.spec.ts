import type { Citation } from '@/types/api'
import { describe, expect, it } from 'vitest'
import { groupCitations, pagesLabel, splitAnswer } from '../citations'
import { findQuote } from '../quoteMatch'

const citations: Citation[] = [
  { number: 2, page_number: 9, quote: 'Receipts are required.' },
  { number: 1, page_number: 4, quote: 'Refunds within 30 days.' },
  { number: 1, page_number: 3, quote: 'Store credit only.' },
  { number: 1, page_number: 4, quote: 'Unless the item is damaged.' },
]

describe('groupCitations', () => {
  it('groups quotes by number with sorted, unique pages', () => {
    const groups = groupCitations(citations)

    expect(groups.map(group => group.number)).toEqual([1, 2])
    expect(groups[0]!.pages).toEqual([3, 4])
    expect(groups[0]!.quotes).toHaveLength(3)
    expect(groups[1]!.pages).toEqual([9])
  })
})

describe('splitAnswer', () => {
  it('turns known markers into citations and keeps the rest as text', () => {
    const parts = splitAnswer('Refunds take 30 days [1]. Keep receipts [2] and see [7].', groupCitations(citations))

    expect(parts.map(part => part.type === 'text' ? part.text : `#${part.group.number}`))
      .toEqual(['Refunds take 30 days ', '#1', '. Keep receipts ', '#2', ' and see [7].'])
  })

  it('handles text without markers', () => {
    expect(splitAnswer('The document does not say.', [])).toEqual([{ type: 'text', text: 'The document does not say.' }])
  })
})

describe('pagesLabel', () => {
  it.each([
    [[14], 'p. 14'],
    [[14, 15, 16], 'pp. 14–16'],
    [[3, 14], 'pp. 3, 14'],
  ])('labels %j', (pages, label) => {
    expect(pagesLabel(pages)).toBe(label)
  })
})

describe('findQuote', () => {
  // Pieces as pdf.js returns them for a page: line by line, with its own spacing.
  const pieces = [
    'Section 3 — Refunds',
    'Customers may return items within ',
    '30 days of purchase. A receipt is ',
    'required for all re-',
    'funds. The “store credit” option',
    ' applies to sale items.',
  ]

  it('finds a quote that spans several pieces', () => {
    expect(findQuote(pieces, 'within 30 days of purchase')).toEqual([1, 2])
  })

  it('ignores differences in spacing, case and quote characters', () => {
    expect(findQuote(pieces, 'The "Store Credit"   option applies')).toEqual([4, 5])
  })

  it('matches ligatures written as one character', () => {
    expect(findQuote(['The ﬁnal deadline is May 1.'], 'final deadline')).toEqual([0])
  })

  it('joins words broken over two lines', () => {
    const quote = 'A receipt is required for all refunds. The "store credit" option applies to sale items.'
    expect(findQuote(pieces, quote)).toEqual([2, 3, 4, 5])
  })

  it('falls back to the start and end of a long quote when the middle differs', () => {
    const page = [
      'The parties agree to inform each other without delay and to work in close co-operation ',
      'on all matters related to the delivery schedule of the goods.',
    ]
    const quote = 'The parties agree to inform each other without delay and to work in close cooperation on all matters related to the delivery schedule of the goods.'
    expect(findQuote(page, quote)).toEqual([0, 1])
  })

  it('returns nothing when the quote is not on the page', () => {
    expect(findQuote(pieces, 'Shipping is free.')).toEqual([])
    expect(findQuote(pieces, ' '.repeat(3))).toEqual([])
  })
})
