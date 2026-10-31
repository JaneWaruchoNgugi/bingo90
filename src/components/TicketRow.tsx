import { Star } from 'lucide-react'
import { winCells, type Grid } from '../game/tickets'

const HEAD = ['B', 'I', 'N', 'G', 'O']

/**
 * A 5 × 5 bingo card under the letters B I N G O, with a free star in the middle. Called numbers
 * light up in the card's colour, and every square on a complete line (row, column or diagonal)
 * turns gold.
 */
export function CardGrid({ g, set, fresh, mini }: { g: Grid; set: Set<number>; fresh?: number | null; mini?: boolean }) {
  const win = winCells(g, set)
  return (
    <div className={'tgrid' + (mini ? ' mini' : '')} role="grid">
      <div className="trow thead" aria-hidden="true">
        {HEAD.map((h, k) => (
          <span key={h} className={'h' + k}>
            {h}
          </span>
        ))}
      </div>
      {g.map((row, r) => (
        <div className="trow" key={r} role="row">
          {row.map((n, c) => {
            const on = win.has(r + ',' + c)
            if (!n)
              return (
                <span key={c} className={'free' + (on ? ' bl' : '')} aria-label="Free">
                  <Star aria-hidden="true" />
                </span>
              )
            return (
              <span key={c} className={(on ? 'bl' : set.has(n) ? 'd' : '') + (n === fresh ? ' fresh' : '')} aria-label={on ? `${n}, on a complete line` : undefined}>
                {n}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
