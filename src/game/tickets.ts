import { STRIP, rnd } from './constants'

/** A 90-ball ticket: 3 rows × 9 columns, 0 = blank. Every row holds five numbers. */
export type Grid = number[][]

export interface Ticket {
  id: number
  rows: Grid
  /** the ticket's fifteen numbers */
  nums: number[]
  price: number
}

const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Numbers of column c: 1–9, 10–19, …, 80–90. */
const colNums = (c: number) => {
  const lo = c === 0 ? 1 : c * 10
  const hi = c === 8 ? 90 : c * 10 + 9
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** Splits all 90 numbers over six tickets: 15 each, one to three per column. */
function splitStrip(): number[][][] | null {
  // per ticket, per column
  const t: number[][][] = Array.from({ length: STRIP }, () => Array.from({ length: 9 }, () => []))
  const extra: { c: number; n: number }[] = []
  for (let c = 0; c < 9; c++) {
    const ns = shuffle(colNums(c))
    for (let k = 0; k < STRIP; k++) t[k][c].push(ns[k])
    ns.slice(STRIP).forEach(n => extra.push({ c, n }))
  }
  // the busiest columns first, so they still find tickets with room
  const counts = (c: number) => extra.filter(e => e.c === c).length
  extra.sort((a, b) => counts(b.c) - counts(a.c) || Math.random() - 0.5)
  for (const e of extra) {
    const size = (k: number) => t[k].reduce((a, col) => a + col.length, 0)
    const ok = shuffle([0, 1, 2, 3, 4, 5]).filter(k => size(k) < 15 && t[k][e.c].length < 3)
    if (!ok.length) return null
    ok.sort((a, b) => size(a) - size(b))
    t[ok[0]][e.c].push(e.n)
  }
  return t
}

/** Lays one ticket's columns into three rows of five, smallest number at the top of each column. */
function layout(cols: number[][]): Grid | null {
  const rows: Grid = [Array(9).fill(0), Array(9).fill(0), Array(9).fill(0)]
  const used = [0, 0, 0]
  const order = shuffle(cols.map((_, c) => c)).sort((a, b) => cols[b].length - cols[a].length)
  for (const c of order) {
    const k = cols[c].length
    const pick = shuffle([0, 1, 2])
      .sort((a, b) => used[a] - used[b])
      .slice(0, k)
      .sort((a, b) => a - b)
    if (pick.some(r => used[r] >= 5)) return null
    const ns = [...cols[c]].sort((a, b) => a - b)
    pick.forEach((r, i) => {
      rows[r][c] = ns[i]
      used[r]++
    })
  }
  return used.every(u => u === 5) ? rows : null
}

/** A strip of six tickets that together hold every number from 1 to 90 exactly once. */
export function makeStrip(): Grid[] {
  for (;;) {
    const s = splitStrip()
    if (!s) continue
    const grids: Grid[] = []
    for (const cols of s) {
      let g: Grid | null = null
      for (let i = 0; i < 30 && !g; i++) g = layout(cols)
      if (!g) break
      grids.push(g)
    }
    if (grids.length === STRIP) return grids
  }
}

export const numsOf = (g: Grid) => g.flat().filter(Boolean)

/** Complete rows of ticket `g` against the called numbers. */
export const rowsDone = (g: Grid, set: Set<number>) => g.filter(r => r.every(n => !n || set.has(n))).length

/** How many numbers ticket `g` still needs for a prize that takes `need` complete rows. */
export function toGo(g: Grid, set: Set<number>, need: number) {
  const left = g.map(r => r.filter(n => n && !set.has(n)).length).sort((a, b) => a - b)
  return left.slice(0, need).reduce((a, b) => a + b, 0)
}
