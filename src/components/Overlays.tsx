import { X } from 'lucide-react'
import { kes } from '../game/constants'
import { TicketRow } from './TicketRow'
import { useGame } from '../hooks/useGame'

/** Short call-outs over the screen: hits, one to go, prizes going to other players. */
export function Toasts() {
  const g = useGame()
  return (
    <div className="toasts" aria-live="polite">
      {g.toasts.map(t => (
        <div key={t.id} className={'toast ' + t.cls}>
          {t.txt}
        </div>
      ))}
    </div>
  )
}

/** A note at the bottom of the screen, e.g. about tickets saved for the next round. */
export function HostNote() {
  const g = useGame()
  if (!g.host) return null
  return (
    <div className="hostnote" role="status" key={g.host.key}>
      <span>{g.host.text}</span>
      <button className="x" aria-label="Dismiss" onClick={() => g.hideHost()}>
        <X aria-hidden="true" />
      </button>
    </div>
  )
}

/** The win popup: the prize, what it paid, and the winning ticket with its complete rows lit. */
export function WinPopup() {
  const g = useGame()
  const w = g.win
  if (!w) return null
  return (
    <div className="winwrap" onClick={() => g.hideWin()} key={w.key}>
      <div className="confetti" aria-hidden="true">
        {w.confetti.map((c, i) => (
          <i
            key={i}
            className={c.round ? 'rnd' : ''}
            style={{ left: c.left, background: c.bg, '--dx': c.dx, '--dy': c.dy, '--rot': c.rot, animationDelay: c.delay, animationDuration: c.dur } as React.CSSProperties}
          />
        ))}
      </div>
      <div className={'winbox' + (w.jackpot ? ' jp' : '')} role="dialog" aria-label={w.title}>
        <p className="wt">{w.title}</p>
        <p className="wp">{w.prize} · {w.balls} balls</p>
        <p className="wamt">{kes(w.pay)}</p>
        <div className="tgrid mini" style={{ '--t': '#ec4899' } as React.CSSProperties}>
          {w.ticket.rows.map((r, ri) => (
            <TicketRow key={ri} row={r} set={g.calledSet} />
          ))}
        </div>
        <p className="wtot">This round: {kes(g.roundWin)}</p>
      </div>
    </div>
  )
}
