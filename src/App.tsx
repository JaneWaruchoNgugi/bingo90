import { useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import { SFX } from './audio/sfx'
import { game } from './game/store'
import { useGame } from './hooks/useGame'
import { BuyBar, DrawPanel } from './components/Buy'
import { ChatPanel } from './components/ChatPanel'
import { Machine } from './components/Machine'
import { HostNote, Toasts, WinPopup } from './components/Overlays'
import { Tickets } from './components/Tickets'
import { TopBar } from './components/TopBar'
import { CalledPanel } from './components/CalledPanel'
import { CardPicker } from './components/CardPicker'

export default function App() {
  const g = useGame()

  useEffect(() => {
    game.start()
    // browsers only let sound start from a tap or key press
    const unlock = () => SFX.init()
    const evs = ['pointerdown', 'keydown', 'touchend'] as const
    evs.forEach(e => window.addEventListener(e, unlock, { passive: true }))
    return () => evs.forEach(e => window.removeEventListener(e, unlock))
  }, [])

  return (
    <>
      <div className={'app ' + g.phase + (g.tickets.length ? ' playing' : '')}>
        <TopBar />
        <div className="colL">
          <DrawPanel />
          <Tickets />
          <BuyBar />
          <footer className="trust">
            <span>
              <ShieldCheck aria-hidden="true" /> Secure &amp; Fair
            </span>
            <span>
              <i className="age">18+</i> Play Responsibly
            </span>
          </footer>
        </div>
        <div className="colM">
          <Machine />
        </div>
        <div className="colR">
          <CalledPanel />
          <ChatPanel />
        </div>
      </div>
      <Toasts />
      <HostNote />
      <WinPopup />
      <CardPicker />
    </>
  )
}
