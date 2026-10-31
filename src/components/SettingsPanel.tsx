import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Menu, Music, Settings, Sparkles, Volume2, X, type LucideIcon } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import type { PrefKey } from '../game/store'

const ROWS: { k: PrefKey; label: string; hint: string; Icon: LucideIcon; c: string }[] = [
  { k: 'sfx', label: 'Game sounds', hint: 'Balls, coins and the crowd', Icon: Volume2, c: '#22d3ee' },
  { k: 'music', label: 'Music', hint: 'Background track', Icon: Music, c: '#22d3ee' },
  { k: 'guide', label: 'Number dots', hint: 'Dots your numbers on the called board', Icon: Sparkles, c: '#22d3ee' },
]

/**
 * Gear button (top left) with the sound, music and guide-light switches. On tablets and desktops
 * the panel drops down from the gear; on phones it is a sheet at the bottom of the screen.
 */
export function SettingsPanel() {
  const g = useGame()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>()
  const gear = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // the panel is rendered at the body, so place it under the gear wherever the scaled stage put it
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = gear.current!.getBoundingClientRect()
      setPos({ top: r.bottom + 10, left: Math.max(12, r.left) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest('.spanel,#snd')) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        gear.current?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <>
      {open &&
        createPortal(
          <>
            <div className="sback" aria-hidden="true" />
            <div
              ref={panel}
              className="spanel"
              role="dialog"
              aria-labelledby="stitle"
              tabIndex={-1}
              style={pos && ({ '--st': pos.top + 'px', '--sl': pos.left + 'px' } as React.CSSProperties)}
            >
              <div className="shead">
                <span className="sico" aria-hidden="true">
                  <Settings />
                </span>
                <h2 id="stitle">Settings</h2>
                <button className="sx" aria-label="Close settings" onClick={() => setOpen(false)}>
                  <X aria-hidden="true" />
                </button>
              </div>
              <ul className="slist">
                {ROWS.map(({ k, label, hint, Icon, c }) => (
                  <li key={k} style={{ '--sc': c } as React.CSSProperties}>
                    <button
                      className={'srow' + (g.prefs[k] ? ' on' : '')}
                      role="switch"
                      aria-checked={g.prefs[k]}
                      onClick={e => {
                        e.stopPropagation()
                        g.setPref(k, !g.prefs[k])
                      }}
                    >
                      <span className="sico" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="stx">
                        <b>{label}</b>
                        <small>{hint}</small>
                      </span>
                      <span className="sw" aria-hidden="true">
                        <i />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>,
          document.body,
        )}
      <button
        ref={gear}
        id="snd"
        aria-label="Menu and settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Menu"
        onClick={e => {
          e.stopPropagation()
          setOpen(o => !o)
        }}
      >
        <Menu aria-hidden="true" />
      </button>
    </>
  )
}
