import { X } from 'lucide-react'
import { kes } from '../game/constants'
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

/** A win: a small banner that slides in under the header and goes by itself, never covering the draw. */
export function WinPopup() {
  const g = useGame()
  const w = g.win
  if (!w) return null
  const i = g.tickets.indexOf(w.ticket)
  return (
    <div className="winbar" role="status" key={w.key}>
      <b>{w.title}</b>
      <em>+{kes(w.pay)}</em>
      {i >= 0 && <small>Card {i + 1}</small>}
    </div>
  )
}
