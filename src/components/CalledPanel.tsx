import { BUY_SECS, CALLS, MAX_CALLS, colorOf } from '../game/constants'
import { useGame } from '../hooks/useGame'
import { Ball } from './Ball'

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** The caller's line: the rhyme if the number has one, otherwise its digits, e.g. "Five and seven, 57". */
const callOf = (n: number) =>
  CALLS[n] ? `${CALLS[n]}, ${n}` : n < 10 ? `On its own, number ${n}` : n % 10 === 0 ? `Number ${n}` : `${WORDS[Math.floor(n / 10)]} and ${WORDS[n % 10]}, ${n}`.replace(/^./, c => c.toUpperCase())

/** Every ball called this round, in order, in MAX_CALLS slots; the latest one big at the top. */
export function CalledPanel() {
  const g = useGame()
  const n = g.called.length
  const buying = g.phase === 'buy'
  return (
    <section className="panel calledp" aria-label="Called numbers">
      <div className="chead">
        {g.last && !buying ? (
          <div className="latest" key={g.last} style={{ '--c': colorOf(g.last) } as React.CSSProperties}>
            <Ball n={g.last} big />
          </div>
        ) : (
          <div className="latest wait" style={{ '--p': buying ? (g.secs / BUY_SECS) * 100 : 100 } as React.CSSProperties}>
            <div>{buying ? <b>{g.timerText}</b> : <b>?</b>}</div>
          </div>
        )}
        <div className="cinfo">
          <h2>
            Called Numbers{' '}
            <span>
              <b>{n}</b> / {MAX_CALLS}
            </span>
          </h2>
          <div className="cbar" aria-hidden="true">
            <i style={{ width: (n / MAX_CALLS) * 100 + '%' }} />
          </div>
          <p aria-live="polite">{buying ? 'Draw starts when the timer ends' : g.last ? callOf(g.last) : 'Waiting for the first ball'}</p>
        </div>
      </div>
      <div className="cgrid">
        {Array.from({ length: MAX_CALLS }, (_, k) =>
          k < n ? (
            <Ball key={k} n={g.called[k]} />
          ) : (
            <i key={k} className={'cslot' + (k === n && g.phase === 'draw' ? ' next' : '')}>
              {k + 1}
            </i>
          ),
        )}
      </div>
    </section>
  )
}
