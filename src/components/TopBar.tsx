import { useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Plus, UserRound, Volume2, VolumeX } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import { SettingsPanel } from './SettingsPanel'

/** Counts the shown balance up to the real one when money comes in, so a win is easy to see. */
function useCountUp(target: number, hold: boolean) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    // while the win popup covers the screen, wait, so the player sees the money arrive
    if (hold && target > start) return
    if (target <= start) {
      from.current = target
      setShown(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1200)
      const v = start + (target - start) * (1 - (1 - k) ** 3)
      from.current = v
      setShown(k < 1 ? v : target)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, hold])
  return shown
}

/** The header: menu, logo, room, balance with top-up, then sound, fullscreen and the player. */
export function TopBar() {
  const g = useGame()
  const [full, setFull] = useState(false)
  const [me, setMe] = useState(false)
  const meRef = useRef<HTMLDivElement>(null)
  const bal = useCountUp(g.pts, false)
  const rising = bal < g.pts

  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  useEffect(() => {
    if (!me) return
    const close = (e: PointerEvent) => !meRef.current?.contains(e.target as Node) && setMe(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [me])

  const toggleFull = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()
    p?.catch(() => {})
  }

  return (
    <header className="topbar">
      <SettingsPanel />
      <div className="logo" aria-label="Bingo 90">
        <span className="l1">BINGO</span>
        <span className="l2">90</span>
      </div>
      <div className="room">
        <span>
          <i className="live" aria-hidden="true" /> {g.players} players
        </span>
      </div>
      <div className={'bal' + (rising ? ' up' : '')}>
        {g.gain && (
          <span key={g.gain.key} className="gain" aria-live="polite">
            +KES {g.gain.amt.toLocaleString('en-US')}
          </span>
        )}
        <span className="coin" aria-hidden="true">
          K
        </span>
        <span className="bt">
          <em>Balance</em>
          <b>KES {(Math.round(bal * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
        </span>
        <button className="topup" aria-label="Add demo credit" title="Add KES 500 demo credit" onClick={() => g.topUp()}>
          <Plus aria-hidden="true" />
        </button>
      </div>
      <div className="tools">
        <button className="ico" aria-label={g.soundOn ? 'Mute sound' : 'Turn sound on'} onClick={() => g.toggleSound()}>
          {g.soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        </button>
        <button className="ico" aria-label={full ? 'Leave full screen' : 'Full screen'} onClick={toggleFull}>
          {full ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
        </button>
        <div className="me" ref={meRef}>
          <button className="ico" aria-label="Your profile" aria-expanded={me} onClick={() => setMe(v => !v)}>
            <UserRound aria-hidden="true" />
          </button>
          {me && (
            <div className="mepop" role="dialog" aria-label="Your profile">
              <b>Guest player</b>
              <span>
                Won this round: KES {g.roundWin.toLocaleString('en-US')}
              </span>
              <span>Demo balance, no real money.</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
