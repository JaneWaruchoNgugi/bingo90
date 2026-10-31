import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { PRIZES, kes } from '../game/constants'
import { CardGrid } from './TicketRow'
import { useGame } from '../hooks/useGame'

/** One frame colour per card, in buying order. */
export const THEMES = ['#3b82f6', '#ec4899', '#10b981', '#a855f7', '#f59e0b', '#06b6d4']

/** The player's cards, stacked two by two, with tabs to see all of them or one up close. */
export function Tickets() {
  const g = useGame()
  const set = g.calledSet
  const cards = g.sorted.slice().sort((a, b) => a.i - b.i)
  const [focus, setFocus] = useState(-1)
  // a new set of cards starts on the overview
  const first = g.tickets[0]?.id
  useEffect(() => setFocus(-1), [first])
  const spent = g.tickets.reduce((s, t) => s + t.price, 0)
  const shown = focus < 0 ? cards : cards.filter(c => c.i === focus)
  return (
    <section className="panel tickets" aria-label="Your cards">
      {!g.tickets.length ? (
        <>
          <div className="thd">
            <h2>Your cards</h2>
          </div>
          <p className="tempty">
            {g.phase === 'buy' ? 'Choose a stake or pick your own cards before the timer ends.' : 'You are watching this round. Cards you buy now play in the next one.'}
          </p>
        </>
      ) : (
        <>
          <nav className="ttabs" aria-label="Show cards">
            <button className={focus < 0 ? 'on' : ''} aria-pressed={focus < 0} onClick={() => setFocus(-1)}>
              All
            </button>
            {cards.map(({ t, i, tg }) => (
              <button
                key={t.id}
                className={(focus === i ? 'on' : '') + (g.phase !== 'buy' && tg <= 1 ? ' hot' : '')}
                style={{ '--t': THEMES[i % THEMES.length] } as React.CSSProperties}
                aria-pressed={focus === i}
                onClick={() => setFocus(i)}
              >
                Card {i + 1}
                <small>{g.phase === 'buy' ? kes(t.price) : tg === 0 ? 'Won' : `${tg} to go`}</small>
              </button>
            ))}
          </nav>
          <p className="tbought">
            <Check aria-hidden="true" /> {g.tickets.length} card{g.tickets.length === 1 ? '' : 's'} bought · {kes(spent)}
          </p>
          <div className={'tlist' + (focus < 0 && cards.length > 1 ? ' stack' : ' one')}>
            {shown.map(({ t, i, tg }) => {
              const marked = t.nums.filter(n => set.has(n))
              return (
                <article
                  key={t.id}
                  className={'ticket' + (g.phase === 'draw' && tg <= 1 ? ' hot' : '')}
                  style={{ '--t': THEMES[i % THEMES.length] } as React.CSSProperties}
                  aria-label={`Card ${i + 1}`}
                  onClick={() => focus < 0 && cards.length > 1 && setFocus(i)}
                >
                  <header>
                    <b>
                      Card {i + 1} <em>{kes(t.price)}</em>
                    </b>
                    <span className={'tg' + (g.phase !== 'buy' && tg === 0 ? ' done' : '')}>
                      {g.phase === 'buy' ? '24 nos' : tg === 0 ? 'Won all' : `${tg} to go`}
                    </span>
                  </header>
                  <CardGrid g={t.rows} set={set} fresh={g.fresh} />
                  <footer>
                    <span className="tbar" aria-hidden="true">
                      <i style={{ width: (marked.length / 24) * 100 + '%' }} />
                    </span>
                    <b>{marked.length}/24</b>
                  </footer>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
