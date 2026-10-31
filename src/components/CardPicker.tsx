import { useEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { MAX_CARDS, PRICES, PRIZES, kes, prizeAt } from '../game/constants'
import { useGame } from '../hooks/useGame'
import { CardGrid } from './TicketRow'

const NONE = new Set<number>()
/** one frame colour per price, cheapest to dearest, matching the stake chips */
const TIER = ['#0ea5e9', '#e11d48', '#16a34a', '#f59e0b']
const tier = (price: number) => TIER[Math.max(0, PRICES.indexOf(price))]

/** Browse a strip of six cards, swipe or step through them, and take the ones to play. */
export function CardPicker() {
  const g = useGame()
  const p = g.picker
  const swipe = useRef<number | null>(null)

  useEffect(() => {
    if (!p) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') g.closePicker()
      else if (e.key === 'ArrowLeft') g.pickerShow(g.picker!.at - 1)
      else if (e.key === 'ArrowRight') g.pickerShow(g.picker!.at + 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [!!p])

  if (!p) return null
  const n = p.cards.length
  const price = p.prices[p.at]
  const taken = p.taken.includes(p.at)
  const next = g.forNext
  const total = g.pickerTotal
  // where each card sits relative to the one in front: -1 left, 0 front, 1 right
  const off = (i: number) => {
    let d = i - p.at
    if (d > n / 2) d -= n
    if (d < -n / 2) d += n
    return d
  }

  return (
    <div className="picker" role="dialog" aria-modal="true" aria-label="Pick your cards">
      <header className="pkhd">
        <span className="pkring">{next ? 'NEXT' : 'NOW'}</span>
        <div>
          <small>Demo mode</small>
          <h2>Cards for {next ? 'next round' : 'this round'}</h2>
          <p>
            {p.quick
              ? `Quick pick · ${p.taken.length} cards at ${kes(p.quick)} · swap any you like`
              : `Swipe to look · tap to take up to ${MAX_CARDS} · dearer cards pay bigger prizes`}
          </p>
        </div>
      </header>

      <div
        className="pkdeck"
        onPointerDown={e => (swipe.current = e.clientX)}
        onPointerUp={e => {
          const x0 = swipe.current
          swipe.current = null
          if (x0 === null) return
          const dx = e.clientX - x0
          if (Math.abs(dx) > 40) g.pickerShow(p.at + (dx < 0 ? 1 : -1))
        }}
      >
        {p.cards.map((rows, i) => {
          const d = off(i)
          if (Math.abs(d) > 1) return null
          const mine = p.taken.includes(i)
          return (
            <article
              key={i}
              className={'ticket pkcard' + (d === 0 ? ' front' : d < 0 ? ' left' : ' right') + (mine ? ' taken' : '')}
              style={{ '--t': tier(p.prices[i]) } as React.CSSProperties}
              aria-label={`Card ${i + 1}, ${kes(p.prices[i])}${mine ? ', taken' : ''}`}
              aria-hidden={d !== 0}
              onClick={() => (d === 0 ? g.pickerTake() : g.pickerShow(i))}
            >
              <header>
                <b>Card {i + 1}</b>
                <span className="tg">{mine ? 'Taken' : '24 numbers'}</span>
              </header>
              <CardGrid g={rows} set={NONE} />
              <p className="pkpays">
                {PRIZES.map(z => (
                  <span key={z.label}>
                    {z.label} <b>{kes(prizeAt(p.prices[i], z.level))}</b>
                  </span>
                ))}
              </p>
              <span className="pkprice">{kes(p.prices[i])}</span>
              {mine && (
                <span className="pkcheck" aria-hidden="true">
                  <Check />
                </span>
              )}
            </article>
          )
        })}
      </div>

      <div className="pknav">
        <button className="ghost pkarrow" aria-label="Previous card" onClick={() => g.pickerShow(p.at - 1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className={'pktake' + (taken ? ' on' : '')} onClick={() => g.pickerTake()}>
          {taken ? (
            <>
              <Check aria-hidden="true" /> Taken · tap to put back
            </>
          ) : (
            <>Take · {kes(price)}</>
          )}
        </button>
        <button className="ghost pkarrow" aria-label="Next card" onClick={() => g.pickerShow(p.at + 1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="pkslots" aria-label={`${p.taken.length} of ${MAX_CARDS} cards taken`}>
        {Array.from({ length: MAX_CARDS }, (_, k) => {
          const i = p.taken[k]
          return i === undefined ? (
            <i key={k} />
          ) : (
            <i key={k} className="on" style={{ '--t': tier(p.prices[i]) } as React.CSSProperties} onClick={() => g.pickerShow(i)}>
              {i + 1}
            </i>
          )
        })}
      </div>

      <div className="pkfoot">
        <button className="ghost" onClick={() => g.closePicker()}>
          Cancel
        </button>
        <button className="pkbuy" disabled={!p.taken.length} onClick={() => g.pickerBuy()}>
          {p.taken.length ? `Buy ${p.taken.length} card${p.taken.length > 1 ? 's' : ''} · Total ${kes(total)}` : 'Take a card'}
        </button>
      </div>
    </div>
  )
}
