import { useEffect, useRef } from 'react'
import { game } from '../game/store'
import { BUY_SECS, JACKPOT_BALLS, JACKPOT_X, PRIZES, kes } from '../game/constants'
import { H, W, startGlobe } from '../engine/globe'
import { useGame } from '../hooks/useGame'

/** The glass globe with its seven outlets: each drawn ball rides a pipe up to the tray on top. */
export function Machine() {
  const g = useGame()
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => startGlobe(canvas.current!, game.tower), [])

  const buying = g.phase === 'buy'
  const stage = Math.min(g.stage, 2)
  const price = g.tickets[0]?.price ?? g.buy.price
  return (
    <section className="panel machine" aria-label="Ball machine">
      <p className="prizeline">
        {g.phase === 'end' ? (
          'Round over'
        ) : (
          <>
            {buying ? 'First prize' : 'Playing for'} <b>{PRIZES[stage].label}</b> <em>{kes(g.prizeValues[stage])}</em>
          </>
        )}
        <span className="jp">
          Jackpot: Full House in {JACKPOT_BALLS} balls pays <em>{kes(price * JACKPOT_X)}</em>
        </span>
      </p>
      <div className="globe" style={{ aspectRatio: W + '/' + H }}>
        <canvas ref={canvas} aria-hidden="true" />
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
