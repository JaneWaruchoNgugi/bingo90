import { BALLS, PRIZES, STRIP, rnd } from './constants'

/**
 * A bingo card: 5 rows × 5 columns under B I N G O. Column c holds numbers from its own
 * range (B 1–15, I 16–30, N 31–45, G 46–60, O 61–75 with 75 balls). The middle square is
 * free (0) and counts as marked.
 */
export type Grid = number[][]

export interface Ticket {
  id: number
  rows: Grid
  /** the card's 24 numbers */
  nums: number[]
  price: number
}

export const SIZE = 5
/** numbers per column */
export const SPAN = BALLS / SIZE

const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** One random card. */
export function makeCard(): Grid {
  const cols = Array.from({ length: SIZE }, (_, c) => shuffle(Array.from({ length: SPAN }, (_, i) => c * SPAN + i + 1)).slice(0, SIZE))
  const g: Grid = Array.from({ length: SIZE }, (_, r) => cols.map(col => col[r]))
  g[2][2] = 0
  return g
}

/** A set of different cards to choose from (no two share a column). */
export function makeStrip(): Grid[] {
  return Array.from({ length: STRIP }, makeCard)
}

export const numsOf = (g: Grid) => g.flat().filter(Boolean)

/** Every line on a card as a list of [row, col] cells: 5 rows, 5 columns and 2 diagonals. */
export const LINES: [number, number][][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => [r, c] as [number, number])),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => [r, c] as [number, number])),
  Array.from({ length: SIZE }, (_, i) => [i, i] as [number, number]),
  Array.from({ length: SIZE }, (_, i) => [i, SIZE - 1 - i] as [number, number]),
]

const marked = (g: Grid, set: Set<number>, [r, c]: [number, number]) => !g[r][c] || set.has(g[r][c])

/** The lines of card `g` that are complete. */
export const doneLines = (g: Grid, set: Set<number>) => LINES.filter(l => l.every(p => marked(g, set, p)))

/** The prize level a card has reached: 0 none, then 1, 2… for each prize in PRIZES. */
export function levelOf(g: Grid, set: Set<number>) {
  const n = doneLines(g, set).length
  return PRIZES.filter(z => n >= z.lines).length
}

/** How many numbers card `g` still needs to reach prize level `need` (1, 2…). */
export function toGo(g: Grid, set: Set<number>, need: number) {
  const k = PRIZES[need - 1]?.lines ?? LINES.length
  const miss = LINES.map(l => l.filter(p => !marked(g, set, p)).map(([r, c]) => g[r][c]))
  let best = 99
  const pick = (from: number, left: number, have: number[]) => {
    if (left === 0) {
      best = Math.min(best, new Set(have).size)
      return
    }
    for (let a = from; a <= miss.length - left; a++) pick(a + 1, left - 1, have.concat(miss[a]))
  }
  pick(0, k, [])
  return best
}

/** The cells of card `g` that sit on a complete line (or all of them for a full house), as "r,c". */
export function winCells(g: Grid, set: Set<number>) {
  const out = new Set<string>()
  // lines only light up once they pay
  if (!levelOf(g, set)) return out
  doneLines(g, set).forEach(l => l.forEach(([r, c]) => out.add(r + ',' + c)))
  return out
}
