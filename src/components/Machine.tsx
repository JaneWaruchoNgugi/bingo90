import { useEffect, useRef } from 'react'
import { game } from '../game/store'
import { BUY_SECS, MAX_CALLS, PRIZES, kes, prizeAt } from '../game/constants'
import { H, W, startGlobe } from '../engine/globe'
import { useGame } from '../hooks/useGame'
import { Ball } from './Ball'

/** The glass globe with its seven outlets: each drawn ball rides a pipe up to the tray on top. */
export function Machine() {
  const g = useGame()
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => startGlobe(canvas.current!, game.tower), [])

  const buying = g.phase === 'buy'
  // the balls in the tray right now: it fills seven at a time, like the machine's
  const shown = g.called.length ? ((g.called.length - 1) % 7) + 1 : 0
  const tray = buying ? [] : g.called.slice(g.called.length - shown)
  const price = g.tickets[0]?.price ?? g.buy.price
  return (
    <section className="panel machine" aria-label="Ball machine">
      <p className="prizeline">
        {g.phase === 'end' ? (
          'Round over'
        ) : (
          // every card pays for each prize it reaches, so show what one card of this price wins
          PRIZES.map(z => (
            <span key={z.label}>
              {z.label} <em>{kes(prizeAt(price, z.level))}</em>
            </span>
          ))
        )}
        <span className="jp">
          {MAX_CALLS} balls · every card pays · {kes(price)} card
        </span>
      </p>
      <div className="globe" style={{ aspectRatio: W + '/' + H }}>
        <canvas ref={canvas} aria-hidden="true" />
        {/* phones with cards: a bigger copy of the tray over the small machine, so the drawn balls stay readable */}
        <div className="mtray" aria-hidden="true">
          {Array.from({ length: 7 }, (_, k) => {
            const n = tray[k]
            return <span key={k}>{n ? <Ball key={n} n={n} /> : null}</span>
          })}
        </div>
        {buying && (
          // the countdown to the draw, over the empty top of the globe
          <div className="latest wait mcount" role="timer" aria-label={`Draw starts in ${g.timerText}`} style={{ '--p': (g.secs / BUY_SECS) * 100 } as React.CSSProperties}>
            <div>
              <b>{g.timerText}</b>
              <small>until draw</small>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
