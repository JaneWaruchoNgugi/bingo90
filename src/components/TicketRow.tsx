/**
 * One row of a 90-ball ticket as five number tiles (the blank squares are left out). Called
 * numbers light up in the ticket's colour; once all five are called the row is a line and its
 * tiles turn into the letters B I N G O.
 */
export function TicketRow({ row, set, fresh }: { row: number[]; set: Set<number>; fresh?: number | null }) {
  const full = row.every(n => !n || set.has(n))
  let k = 0
  return (
    <div className={'trow' + (full ? ' full' : '')}>
      {row.map((n, ci) => {
        if (!n) return null
        const letter = full ? 'BINGO'[k++] : ''
        return (
          <span
            key={ci}
            className={(full ? 'bl' : set.has(n) ? 'd' : '') + (n === fresh ? ' fresh' : '')}
            style={{ '--k': k } as React.CSSProperties}
            aria-label={full ? `${n}, line complete` : undefined}
          >
            {letter || n}
          </span>
        )
      })}
    </div>
  )
}
