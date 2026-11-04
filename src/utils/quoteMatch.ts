/**
 * Finds a cited quote in a PDF page's text as pdf.js returns it (a list of text
 * pieces). The server checked the quote against its own text extraction, which can
 * differ in spacing, line breaks, ligatures and quote characters, so both sides are
 * compared without whitespace and in a normalised form.
 */

const IGNORED = /[\s­]/u
const EQUIVALENT: Record<string, string> = {
  '‘': '\'',
  '’': '\'',
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
}

/** Normalised characters, each with the index of the piece it came from. */
function normalise (pieces: string[]): { text: string, owners: number[] } {
  let text = ''
  const owners: number[] = []
  for (const [index, original] of pieces.entries()) {
    // A word broken over two lines ("re-" + "funds"): drop the line-end hyphen.
    const trimmed = original.trimEnd()
    const piece = trimmed.endsWith('-') && index < pieces.length - 1 ? trimmed.slice(0, -1) : original
    for (const char of piece.normalize('NFKC').toLowerCase()) {
      if (IGNORED.test(char)) {
        continue
      }
      text += EQUIVALENT[char] ?? char
      owners.push(index)
    }
  }
  return { text, owners }
}

/** How much of the start and end of a quote is used when the whole quote is not found. */
const EDGE = 40

/** Indexes of the pieces that contain the quote (empty when it cannot be found). */
export function findQuote (pieces: string[], quote: string): number[] {
  const page = normalise(pieces)
  const wanted = normalise([quote]).text
  if (wanted === '') {
    return []
  }

  let start = page.text.indexOf(wanted)
  let end = start + wanted.length

  // Differences in the middle (e.g. a hyphenated line break): match the start and
  // the end of the quote separately, if they are close together.
  if (start === -1 && wanted.length > EDGE * 2) {
    start = page.text.indexOf(wanted.slice(0, EDGE))
    const tail = start === -1 ? -1 : page.text.indexOf(wanted.slice(-EDGE), start)
    end = tail + EDGE
    if (tail === -1 || end - start > wanted.length * 1.5) {
      return []
    }
  }
  if (start === -1) {
    return []
  }

  return [...new Set(page.owners.slice(start, end))]
}
