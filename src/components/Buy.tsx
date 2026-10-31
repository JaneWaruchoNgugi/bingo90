import { Crown, Radio, RefreshCw, Ticket, TriangleAlert } from 'lucide-react'
import { MAX_CALLS, PRICES, QUICK, kes } from '../game/constants'
import { useGame } from '../hooks/useGame'

/** One casino chip per stake: tapping one quick-picks four cards at that price. */
function Chips() {
  const g = useGame()
  return (
    <div className="chips">
      {PRICES.map((p, i) => (
        <div key={p} className="chipw">
          <button
            aria-label={`Quick pick ${QUICK} cards at ${kes(p)} each, ${kes(p * QUICK)} in total`}
            className={'chip c' + i + (g.picker?.quick === p ? ' on' : '')}
            disabled={!g.canBuy}
            onClick={() => g.quickPick(p)}
          >
            <i aria-hidden="true">
              <small>KSh</small>
              {p}
            </i>
          </button>
          <span className="ctot" aria-hidden="true">
            Total <b>{p * QUICK}</b>
          </span>
        </div>
      ))}
    </div>
  )
}

/** The way into the card picker. */
function PickButton() {
  const g = useGame()
  return (
    <button className="pick" disabled={!g.canBuy} onClick={() => g.openPicker()}>
      <Ticket aria-hidden="true" />
      <span>Pick your own cards</span>
    </button>
  )
}

/** Stake chips over the pick button. */
function Shop() {
  return (
    <div className="shop">
      <div className="shophd">
        <Crown aria-hidden="true" /> Choose your stake <span>{QUICK} cards</span>
      </div>
      <Chips />
      <PickButton />
    </div>
  )
}

/** What the player already holds for this round or the next, with the buttons that go with it. */
function Owned() {
  const g = useGame()
  const owned = g.forNext ? g.queued : g.tickets
  return (
    <div className="owned">
      <Ticket className="oico" aria-hidden="true" />
      <p>
        <b>
          {owned.length} card{owned.length > 1 ? 's' : ''} {g.forNext ? 'saved for next round' : 'in play'}
        </b>
        <span>
          {kes(owned.reduce((a, t) => a + t.price, 0))} in total
        </span>
      </p>
      {(g.phase === 'buy' || g.forNext) && (
        <div className="row2">
          {g.phase === 'buy' && (
            <button className="ghost" onClick={() => g.reshuffle()}>
              <RefreshCw aria-hidden="true" /> New numbers
            </button>
          )}
          <button className="ghost" onClick={() => g.refund()}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

/** Desktop: the round status and the ticket shop in one panel under the globe. */
export function DrawPanel() {
  const g = useGame()
  const owned = g.forNext ? g.queued : g.tickets
  return (
    <section className={'panel drawp ' + g.phase} aria-label="Round and cards">
      <div className="status">
        <span className="sico" aria-hidden="true">
          <Radio />
        </span>
        <div>
          <b>{g.phase === 'buy' ? 'Buy cards' : g.phase === 'draw' ? 'Live draw' : 'Round over'}</b>
          <span>
            {g.phase === 'buy' ? `Draw in ${g.timerText} · ` : `${MAX_CALLS} balls · `}
            {g.players} players
          </span>
        </div>
      </div>
      {g.forNext && !owned.length && (
        <p className="nextnote">
          <TriangleAlert aria-hidden="true" /> This draw has started. Cards you buy now will play in the next round.
        </p>
      )}
      {owned.length ? (
        <Owned />
      ) : (
        <>
          <Shop />
        </>
      )}
    </section>
  )
}

/** Phones: the stake chips and the pick button, under the machine. */
export function BuyBar() {
  const g = useGame()
  const owned = g.forNext ? g.queued : g.tickets
  // once you have tickets in this round, the buy bar steps aside: your tickets show just below
  if (g.tickets.length) return null
  return (
    <section className="buybar" aria-label="Buy cards">
      {owned.length ? (
        <Owned />
      ) : (
        <>
          {g.forNext && <p className="nextnote">Cards bought now play in the next round.</p>}
          <Shop />
        </>
      )}
    </section>
  )
}
